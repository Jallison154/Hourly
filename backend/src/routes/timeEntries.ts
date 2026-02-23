import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { z } from 'zod'
import prisma from '../utils/prisma'
import { getCurrentPayPeriodInTimezone, isDateInPayPeriod } from '../utils/payPeriod'
import { applyClockInRounding, applyClockOutRounding } from '../utils/timeRounding'
import { getDateRangeUtc, formatInTimezone } from '../utils/timezone'

const router = express.Router()

const clockInSchema = z.object({
  clockInTime: z.string().datetime().optional() // ISO string, defaults to now
})

const clockOutSchema = z.object({
  clockOutTime: z.string().datetime().optional(), // ISO string, defaults to now
  breakMinutes: z.number().int().min(0).optional() // Break time in minutes
})

const createEntrySchema = z.object({
  clockIn: z.string().datetime(),
  clockOut: z.string().datetime().optional(),
  notes: z.string().optional(),
  isManualEntry: z.boolean().default(true)
})

const updateEntrySchema = z.object({
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  totalBreakMinutes: z.number().int().min(0).optional()
})

const addBreakSchema = z.object({
  breakType: z.enum(['lunch', 'rest', 'other']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  duration: z.number().int().min(0).optional(),
  notes: z.string().optional()
})

const updateBreakSchema = z.object({
  breakType: z.enum(['lunch', 'rest', 'other']).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional().nullable(),
  duration: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable()
})

// Clock in
router.post('/clock-in', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clockInTime } = clockInSchema.parse(req.body)
    let clockIn = clockInTime ? new Date(clockInTime) : new Date()
    
    // Get user's rounding interval
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { timeRoundingInterval: true }
    })
    
    // Apply time rounding (round DOWN for clock-in)
    const roundingInterval = user?.timeRoundingInterval || 5
    const originalClockIn = new Date(clockIn)
    clockIn = applyClockInRounding(clockIn, roundingInterval)
    
    // Log rounding for debugging (can be removed in production)
    if (originalClockIn.getMinutes() !== clockIn.getMinutes()) {
      console.log(`Clock-in rounded: ${originalClockIn.toISOString()} -> ${clockIn.toISOString()}`)
    }
    
    // Idempotent: if already have an open entry, return it (200) instead of 400
    const openEntry = await prisma.timeEntry.findFirst({
      where: {
        userId: req.userId!,
        clockOut: null
      },
      include: { breaks: true }
    })
    if (openEntry) {
      return res.status(200).json(openEntry)
    }
    const entry = await prisma.timeEntry.create({
      data: {
        userId: req.userId!,
        clockIn,
        isManualEntry: !!clockInTime
      },
      include: {
        breaks: true
      }
    })
    res.status(201).json(entry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Clock in error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Clock out
router.post('/clock-out', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clockOutTime, breakMinutes: providedBreakMinutes } = clockOutSchema.parse(req.body)
    let clockOut = clockOutTime ? new Date(clockOutTime) : new Date()
    
    // Get user's rounding interval
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { timeRoundingInterval: true }
    })
    
    // Apply time rounding (round UP for clock-out)
    const roundingInterval = user?.timeRoundingInterval || 5
    clockOut = applyClockOutRounding(clockOut, roundingInterval)
    
    // Find open entry
    const openEntry = await prisma.timeEntry.findFirst({
      where: {
        userId: req.userId!,
        clockOut: null
      },
      include: {
        breaks: true
      }
    })
    
    if (!openEntry) {
      // Idempotent: already clocked out — return last closed entry (200) or null
      const lastClosed = await prisma.timeEntry.findFirst({
        where: {
          userId: req.userId!,
          clockOut: { not: null }
        },
        orderBy: { clockOut: 'desc' },
        include: { breaks: true }
      })
      return res.status(200).json(lastClosed ?? null)
    }
    if (clockOut <= openEntry.clockIn) {
      return res.status(400).json({ error: 'Clock out time must be after clock in time' })
    }
    
    // Calculate total break minutes
    // If breakMinutes provided, use it; otherwise calculate from existing breaks
    let breakMinutes = providedBreakMinutes
    if (breakMinutes === undefined) {
      breakMinutes = openEntry.breaks.reduce((total, b) => {
        if (b.duration) return total + b.duration
        if (b.endTime) {
          const duration = Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000)
          return total + duration
        }
        return total
      }, 0)
    }
    
    // Update entry
    const entry = await prisma.timeEntry.update({
      where: { id: openEntry.id },
      data: {
        clockOut,
        totalBreakMinutes: breakMinutes
      },
      include: {
        breaks: true
      }
    })
    
    res.json(entry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Clock out error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get current status
router.get('/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const openEntry = await prisma.timeEntry.findFirst({
      where: {
        userId: req.userId!,
        clockOut: null
      },
      include: {
        breaks: true
      }
    })
    
    res.json({ isClockedIn: !!openEntry, entry: openEntry })
  } catch (error) {
    console.error('Get status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create manual time entry
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clockIn, clockOut, notes, isManualEntry } = createEntrySchema.parse(req.body)
    
    // Get user's rounding interval
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { timeRoundingInterval: true }
    })
    
    const roundingInterval = user?.timeRoundingInterval || 5
    let clockInDate = applyClockInRounding(new Date(clockIn), roundingInterval)
    let clockOutDate = clockOut ? applyClockOutRounding(new Date(clockOut), roundingInterval) : null
    
    if (clockOutDate && clockOutDate <= clockInDate) {
      return res.status(400).json({ error: 'Clock out time must be after clock in time' })
    }
    
    // Check for overlapping entries
    // Two time ranges [A_start, A_end] and [B_start, B_end] overlap if:
    // A_start < B_end AND B_start < A_end
    const newEntryStart = clockInDate
    const newEntryEnd = clockOutDate || new Date()
    
    console.log('Checking for overlaps:', {
      newEntry: {
        start: newEntryStart.toISOString(),
        end: newEntryEnd.toISOString(),
        isPast: newEntryEnd < new Date()
      }
    })
    
    // Get all entries that might overlap
    // For past entries, only check entries that could actually overlap in time
    // For future entries, check a wider window
    const windowDays = newEntryEnd < new Date() ? 1 : 2 // Smaller window for past entries
    const windowStart = new Date(newEntryStart.getTime() - windowDays * 24 * 60 * 60 * 1000)
    const windowEnd = new Date(newEntryEnd.getTime() + windowDays * 24 * 60 * 60 * 1000)
    
    const potentialOverlaps = await prisma.timeEntry.findMany({
      where: {
        userId: req.userId!,
        clockIn: {
          gte: windowStart,
          lte: windowEnd
        }
      }
    })
    
    console.log(`Found ${potentialOverlaps.length} potential overlaps to check`)
    
    // Check each entry for actual overlap
    const overlapping = potentialOverlaps.find(existing => {
      const existingStart = existing.clockIn
      // For open entries (no clock out), only consider them as overlapping if:
      // - They started before the new entry ends, AND
      // - The new entry is in the future (not in the past)
      // For closed entries, use their actual clock out time
      let existingEnd: Date
      if (existing.clockOut) {
        existingEnd = existing.clockOut
      } else {
        // Open entry - only overlaps if new entry is in the future
        // If new entry is in the past, an open entry can't overlap with it
        if (newEntryEnd <= new Date()) {
          // New entry is in the past, open entry can't overlap
          return false
        }
        // New entry is in the future, treat open entry as extending indefinitely
        existingEnd = new Date()
      }
      
      // Two ranges overlap if: start1 < end2 AND start2 < end1
      const overlaps = existingStart < newEntryEnd && newEntryStart < existingEnd
      
      if (overlaps) {
        console.log('Found overlap:', {
          existing: {
            start: existingStart.toISOString(),
            end: existing.clockOut ? existing.clockOut.toISOString() : 'open (extends to now)'
          },
          newEntry: {
            start: newEntryStart.toISOString(),
            end: newEntryEnd.toISOString()
          }
        })
      }
      
      return overlaps
    })
    
    if (overlapping) {
      const overlapStart = overlapping.clockIn.toISOString()
      const overlapEnd = overlapping.clockOut ? overlapping.clockOut.toISOString() : 'still open'
      return res.status(400).json({ 
        error: 'Time entry overlaps with existing entry',
        details: `Overlaps with entry from ${overlapStart} to ${overlapEnd}`
      })
    }
    
    // Normalize empty string notes to null
    const normalizedNotes = notes && notes.trim() ? notes.trim() : null
    
    const entry = await prisma.timeEntry.create({
      data: {
        userId: req.userId!,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        notes: normalizedNotes,
        isManualEntry: isManualEntry ?? true
      },
      include: {
        breaks: true
      }
    })
    
    res.status(201).json(entry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Create entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get time entries
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query
    
    if (startDate && endDate) {
      const startStr = (startDate as string).trim()
      const endStr = (endDate as string).trim()
      const isDateOnly = startStr.length === 10 && !startStr.includes('T') && endStr.length === 10 && !endStr.includes('T')

      let start: Date
      let end: Date
      if (isDateOnly) {
        const user = await prisma.user.findUnique({
          where: { id: req.userId! },
          select: { timezone: true }
        })
        const tz = user?.timezone ?? 'UTC'
        const range = getDateRangeUtc(startStr, endStr, tz)
        start = range.start
        end = range.end
      } else {
        start = new Date(startStr)
        end = new Date(endStr)
      }
      if (start.getTime() > end.getTime()) {
        return res.status(400).json({ error: 'Start date must be before or equal to end date' })
      }

      console.log('Fetching entries across pay period boundaries:', {
        start: start.toISOString(),
        end: end.toISOString(),
        startLocal: start.toLocaleString(),
        endLocal: end.toLocaleString(),
        userId: req.userId
      })
      
      // First, let's check what entries exist for this user (for debugging)
      const allUserEntries = await prisma.timeEntry.findMany({
        where: {
          userId: req.userId!
        },
        select: {
          id: true,
          clockIn: true,
          clockOut: true
        },
        orderBy: {
          clockIn: 'desc'
        },
        take: 20 // Just get recent entries for debugging
      })
      
      console.log(`User has ${allUserEntries.length} recent entries. Sample:`, allUserEntries.slice(0, 5).map(e => ({
        id: e.id,
        clockIn: e.clockIn.toISOString(),
        clockOut: e.clockOut?.toISOString() || 'open'
      })))
      
      const entries = await prisma.timeEntry.findMany({
        where: {
          userId: req.userId!,
          clockIn: {
            gte: start,
            lte: end
          }
        },
        include: {
          breaks: true
        },
        orderBy: {
          clockIn: 'desc'
        }
      })
      
      console.log(`Found ${entries.length} entries in date range ${start.toISOString()} to ${end.toISOString()}`)
      if (entries.length > 0) {
        console.log('Sample entries:', entries.slice(0, 3).map(e => ({
          id: e.id,
          clockIn: e.clockIn.toISOString(),
          clockOut: e.clockOut?.toISOString() || 'open',
          hours: e.clockOut ? ((e.clockOut.getTime() - e.clockIn.getTime()) / (1000 * 60 * 60) - (e.totalBreakMinutes / 60)).toFixed(2) : 'N/A'
        })))
      }
      
      return res.json(entries)
    }
    
    // If no dates provided, default to current pay period (in user timezone)
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { payPeriodType: true, payPeriodEndDay: true, timezone: true }
    })
    const payPeriod = getCurrentPayPeriodInTimezone(
      new Date(),
      user?.payPeriodType || 'monthly',
      user?.payPeriodEndDay ?? 10,
      user?.timezone ?? 'UTC'
    )
    
    const start = payPeriod.start
    const end = payPeriod.end
    
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: req.userId!,
        clockIn: {
          gte: start,
          lte: end
        }
      },
      include: {
        breaks: true
      },
      orderBy: {
        clockIn: 'desc'
      }
    })
    
    res.json(entries)
  } catch (error) {
    console.error('Get entries error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Export time entries as CSV
// IMPORTANT: This must be defined BEFORE /:id route, otherwise "export" will be treated as an ID
router.get('/export', authenticate, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { timezone: true }
    })
    const tz = user?.timezone ?? 'UTC'

    const where: any = {
      userId: req.userId!
    }

    if (startDate && endDate) {
      const startStr = startDate as string
      const endStr = endDate as string
      const isDateOnly = startStr.length === 10 && !startStr.includes('T') && endStr.length === 10 && !endStr.includes('T')
      if (isDateOnly) {
        const { start, end } = getDateRangeUtc(startStr, endStr, tz)
        if (start.getTime() > end.getTime()) {
          return res.status(400).json({ error: 'Start date must be before or equal to end date' })
        }
        where.clockIn = { gte: start, lte: end }
      } else {
        const start = new Date(startStr)
        const end = new Date(endStr)
        if (start.getTime() > end.getTime()) {
          return res.status(400).json({ error: 'Start date must be before or equal to end date' })
        }
        where.clockIn = { gte: start, lte: end }
      }
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        breaks: true
      },
      orderBy: {
        clockIn: 'asc'
      }
    })

    function formatBreakTime(minutes: number): string {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return `${hours}h ${mins.toString().padStart(2, '0')}m`
    }

    let csv = 'Date Range\n'
    if (startDate && endDate) {
      const startStr = startDate as string
      const endStr = endDate as string
      const isDateOnly = startStr.length === 10 && !startStr.includes('T')
      if (isDateOnly) {
        const { start, end } = getDateRangeUtc(startStr, endStr, tz)
        csv += `${formatInTimezone(start, tz, 'MMMM d, yyyy')} - ${formatInTimezone(end, tz, 'MMMM d, yyyy')}\n`
      } else {
        csv += `${formatInTimezone(new Date(startStr), tz)} - ${formatInTimezone(new Date(endStr), tz)}\n`
      }
    } else {
      csv += 'All Entries\n'
    }
    csv += '\n'
    csv += '"Client Name","Start Time","End Time","Break Time","Worked Hours","Rate/h","Amount","Note"\n'

    const { getEffectiveBreakMinutes } = await import('../utils/breakMinutes')
    entries.forEach((entry) => {
      const clockInStr = entry.clockIn ? formatInTimezone(entry.clockIn, tz) : ''
      const clockOutStr = entry.clockOut ? formatInTimezone(entry.clockOut, tz) : 'Open'
      const totalBreakMinutes = getEffectiveBreakMinutes(entry)
      const breakTimeStr = totalBreakMinutes > 0 ? formatBreakTime(totalBreakMinutes) : '0h 00m'
      let workedHours = '0:00'
      if (entry.clockIn && entry.clockOut) {
        const diffMs = entry.clockOut.getTime() - entry.clockIn.getTime()
        const diffMinutes = Math.floor((diffMs - (totalBreakMinutes * 60 * 1000)) / (1000 * 60))
        const hours = Math.floor(diffMinutes / 60)
        const minutes = diffMinutes % 60
        workedHours = `${hours}:${minutes.toString().padStart(2, '0')}`
      }
      const notes = (entry.notes || '').replace(/"/g, '""')
      csv += `"","${clockInStr}","${clockOutStr}","${breakTimeStr}","${workedHours}","","","${notes}"\n`
    })
    
    // Set headers for CSV download
    const filename = startDate && endDate
      ? `time-entries-${startDate}-${endDate}.csv`
      : `time-entries-${new Date().toISOString().split('T')[0]}.csv`
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (error) {
    console.error('Export error:', error)
    res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Delete all time entries for the user
// IMPORTANT: This must be defined BEFORE /:id route, otherwise "all" will be treated as an ID
router.delete('/all', authenticate, async (req: AuthRequest, res) => {
  try {
    // Delete all entries for this user (breaks will be cascade deleted)
    const result = await prisma.timeEntry.deleteMany({
      where: {
        userId: req.userId!
      }
    })

    console.log(`Deleted all ${result.count} time entries for user ${req.userId}`)

    // Return success even if no entries were found (count is 0)
    res.json({ 
      message: result.count === 0 
        ? 'No time entries found to delete' 
        : `Deleted all ${result.count} time entries`,
      deletedCount: result.count
    })
  } catch (error) {
    console.error('Delete all entries error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get single entry
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!
      },
      include: {
        breaks: true
      }
    })
    
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' })
    }
    
    res.json(entry)
  } catch (error) {
    console.error('Get entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update time entry
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = updateEntrySchema.parse(req.body)
    const updateData: any = {}
    
    if (data.clockIn) updateData.clockIn = new Date(data.clockIn)
    if (data.clockOut !== undefined) updateData.clockOut = data.clockOut ? new Date(data.clockOut) : null
    // Normalize empty string notes to null
    if (data.notes !== undefined) {
      updateData.notes = data.notes && data.notes.trim() ? data.notes.trim() : null
    }
    if (data.totalBreakMinutes !== undefined) updateData.totalBreakMinutes = data.totalBreakMinutes
    
    // Check if entry exists and belongs to user
    const existing = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!
      }
    })
    
    if (!existing) {
      return res.status(404).json({ error: 'Time entry not found' })
    }
    if (updateData.clockOut === null) {
      const otherOpen = await prisma.timeEntry.findFirst({
        where: {
          userId: req.userId!,
          clockOut: null,
          id: { not: req.params.id }
        }
      })
      if (otherOpen) {
        return res.status(409).json({
          error: 'You already have an open time entry. Close it or use that entry before opening another.'
        })
      }
    }
    const clockIn = updateData.clockIn || existing.clockIn
    const clockOut = updateData.clockOut !== undefined ? updateData.clockOut : existing.clockOut
    if (clockOut && clockOut <= clockIn) {
      return res.status(400).json({ error: 'Clock out time must be after clock in time' })
    }
    try {
        const entry = await prisma.timeEntry.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          breaks: true
        }
      })
      res.json(entry)
    } catch (dbError: unknown) {
      const prismaError = dbError as { code?: string }
      if (prismaError.code === 'P2002') {
        return res.status(409).json({
          error: 'You already have an open time entry. Close it or use that entry before opening another.'
        })
      }
      throw dbError
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Update entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete time entry
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!
      }
    })
    
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' })
    }
    
    await prisma.timeEntry.delete({
      where: { id: req.params.id }
    })
    
    res.json({ message: 'Time entry deleted' })
  } catch (error) {
    console.error('Delete entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Add break to time entry
router.post('/:id/breaks', authenticate, async (req: AuthRequest, res) => {
  try {
    const { breakType, startTime, endTime, duration, notes } = addBreakSchema.parse(req.body)
    
    // Check if entry exists and belongs to user
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!
      }
    })
    
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' })
    }
    
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : null
    
    // Calculate duration if not provided
    let breakDuration = duration
    if (!breakDuration && end) {
      breakDuration = Math.round((end.getTime() - start.getTime()) / 60000)
    }
    
    // Normalize empty string notes to null
    const normalizedNotes = notes && notes.trim() ? notes.trim() : null
    
    const breakEntry = await prisma.break.create({
      data: {
        timeEntryId: req.params.id,
        breakType,
        startTime: start,
        endTime: end,
        duration: breakDuration || 0,
        notes: normalizedNotes
      }
    })
    
    // Update total break minutes on time entry
    const allBreaks = await prisma.break.findMany({
      where: { timeEntryId: req.params.id }
    })
    
    const totalBreakMinutes = allBreaks.reduce((total, b) => {
      if (b.duration) return total + b.duration
      if (b.endTime) {
        const dur = Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000)
        return total + dur
      }
      return total
    }, 0)
    
    await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: { totalBreakMinutes }
    })
    
    res.status(201).json(breakEntry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Add break error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update break
router.put('/breaks/:breakId', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = updateBreakSchema.parse(req.body)
    const updateData: any = {}
    
    if (data.breakType) updateData.breakType = data.breakType
    if (data.startTime) updateData.startTime = new Date(data.startTime)
    if (data.endTime !== undefined) updateData.endTime = data.endTime ? new Date(data.endTime) : null
    if (data.duration !== undefined) updateData.duration = data.duration
    // Normalize empty string notes to null
    if (data.notes !== undefined) {
      updateData.notes = data.notes && data.notes.trim() ? data.notes.trim() : null
    }
    
    // Check if break exists and belongs to user's entry
    const breakEntry = await prisma.break.findFirst({
      where: { id: req.params.breakId },
      include: {
        timeEntry: true
      }
    })
    
    if (!breakEntry || breakEntry.timeEntry.userId !== req.userId) {
      return res.status(404).json({ error: 'Break not found' })
    }
    
    // Recalculate duration if endTime changed
    if (updateData.endTime !== undefined && updateData.endTime) {
      const start = updateData.startTime || breakEntry.startTime
      updateData.duration = Math.round((updateData.endTime.getTime() - start.getTime()) / 60000)
    }
    
    const updated = await prisma.break.update({
      where: { id: req.params.breakId },
      data: updateData
    })
    
    // Update total break minutes on time entry
    const allBreaks = await prisma.break.findMany({
      where: { timeEntryId: breakEntry.timeEntryId }
    })
    
    const totalBreakMinutes = allBreaks.reduce((total, b) => {
      if (b.duration) return total + b.duration
      if (b.endTime) {
        const dur = Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000)
        return total + dur
      }
      return total
    }, 0)
    
    await prisma.timeEntry.update({
      where: { id: breakEntry.timeEntryId },
      data: { totalBreakMinutes }
    })
    
    res.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Update break error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete break
router.delete('/breaks/:breakId', authenticate, async (req: AuthRequest, res) => {
  try {
    const breakEntry = await prisma.break.findFirst({
      where: { id: req.params.breakId },
      include: {
        timeEntry: true
      }
    })
    
    if (!breakEntry || breakEntry.timeEntry.userId !== req.userId) {
      return res.status(404).json({ error: 'Break not found' })
    }
    
    await prisma.break.delete({
      where: { id: req.params.breakId }
    })
    
    // Update total break minutes on time entry
    const allBreaks = await prisma.break.findMany({
      where: { timeEntryId: breakEntry.timeEntryId }
    })
    
    const totalBreakMinutes = allBreaks.reduce((total, b) => {
      if (b.duration) return total + b.duration
      if (b.endTime) {
        const dur = Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000)
        return total + dur
      }
      return total
    }, 0)
    
    await prisma.timeEntry.update({
      where: { id: breakEntry.timeEntryId },
      data: { totalBreakMinutes }
    })
    
    res.json({ message: 'Break deleted' })
  } catch (error) {
    console.error('Delete break error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete multiple time entries by date range
// Using POST instead of DELETE because some HTTP clients don't support DELETE with body
router.post('/bulk-delete', authenticate, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.body
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { timezone: true }
    })
    const tz = user?.timezone ?? 'UTC'

    const startStr = String(startDate).trim()
    const endStr = String(endDate).trim()
    const isDateOnly = startStr.length === 10 && !startStr.includes('T') && endStr.length === 10 && !endStr.includes('T')

    let start: Date
    let end: Date
    if (isDateOnly) {
      const range = getDateRangeUtc(startStr, endStr, tz)
      start = range.start
      end = range.end
    } else {
      start = new Date(startDate)
      end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' })
    }

    if (start > end) {
      return res.status(400).json({ error: 'Start date must be before end date' })
    }

    const result = await prisma.timeEntry.deleteMany({
      where: {
        userId: req.userId!,
        clockIn: {
          gte: start,
          lte: end
        }
      }
    })

    res.json({ 
      message: `Deleted ${result.count} time entries`,
      deletedCount: result.count
    })
  } catch (error) {
    console.error('Bulk delete error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router


