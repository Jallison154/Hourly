import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { z } from 'zod'
import prisma from '../utils/prisma'
import { getCurrentPayPeriod, isDateInPayPeriod } from '../utils/payPeriod'
import { applyClockInRounding, applyClockOutRounding } from '../utils/timeRounding'

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
    
    // Check if there's an open entry
    const openEntry = await prisma.timeEntry.findFirst({
      where: {
        userId: req.userId!,
        clockOut: null
      }
    })
    
    if (openEntry) {
      return res.status(400).json({ error: 'You already have an open time entry. Please clock out first.' })
    }
    
    // Create new entry
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
      return res.status(400).json({ error: 'No open time entry found' })
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
    
    const entry = await prisma.timeEntry.create({
      data: {
        userId: req.userId!,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        notes,
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
    
    // If startDate and endDate are provided, use them directly (for weekly calculations, etc.)
    // This allows fetching entries across pay period boundaries
    if (startDate && endDate) {
      const start = new Date(startDate as string)
      const end = new Date(endDate as string)
      
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
    
    // If no dates provided, default to current pay period
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { payPeriodType: true, payPeriodEndDay: true }
    })
    const payPeriod = getCurrentPayPeriod(
      new Date(),
      user?.payPeriodType || 'monthly',
      user?.payPeriodEndDay || 10
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
    if (data.notes !== undefined) updateData.notes = data.notes
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
    
    // Validate times
    const clockIn = updateData.clockIn || existing.clockIn
    const clockOut = updateData.clockOut !== undefined ? updateData.clockOut : existing.clockOut
    
    if (clockOut && clockOut <= clockIn) {
      return res.status(400).json({ error: 'Clock out time must be after clock in time' })
    }
    
    const entry = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        breaks: true
      }
    })
    
    res.json(entry)
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
    
    const breakEntry = await prisma.break.create({
      data: {
        timeEntryId: req.params.id,
        breakType,
        startTime: start,
        endTime: end,
        duration: breakDuration || 0,
        notes
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
    if (data.notes !== undefined) updateData.notes = data.notes
    
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

    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999) // Include the entire end date

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' })
    }

    if (start > end) {
      return res.status(400).json({ error: 'Start date must be before end date' })
    }

    // Delete entries in the date range for this user
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

// Export time entries as CSV
router.get('/export', authenticate, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query
    
    // Build where clause
    const where: any = {
      userId: req.userId!
    }
    
    // Add date filter if provided
    if (startDate || endDate) {
      where.clockIn = {}
      if (startDate) {
        where.clockIn.gte = new Date(startDate as string)
      }
      if (endDate) {
        const end = new Date(endDate as string)
        end.setHours(23, 59, 59, 999)
        where.clockIn.lte = end
      }
    }
    
    // Get all time entries with breaks
    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        breaks: true
      },
      orderBy: {
        clockIn: 'asc'
      }
    })
    
    // Format date for CSV (e.g., "December 10, 2025")
    function formatDateForCSV(date: Date): string {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December']
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    }
    
    // Format time for CSV (e.g., "11:10:00 AM")
    function formatTimeForCSV(date: Date): string {
      const hours = date.getHours()
      const minutes = date.getMinutes()
      const seconds = date.getSeconds()
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours % 12 || 12
      return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`
    }
    
    // Format full datetime for CSV (e.g., "December 10, 2025 at 11:10:00 AM")
    function formatDateTimeForCSV(date: Date): string {
      return `${formatDateForCSV(date)} at ${formatTimeForCSV(date)}`
    }
    
    // Format break time (e.g., "0h 15m")
    function formatBreakTime(minutes: number): string {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return `${hours}h ${mins.toString().padStart(2, '0')}m`
    }
    
    // Build CSV content
    let csv = 'Date Range\n'
    if (startDate && endDate) {
      csv += `${formatDateForCSV(new Date(startDate as string))} - ${formatDateForCSV(new Date(endDate as string))}\n`
    } else {
      csv += 'All Entries\n'
    }
    csv += '\n'
    csv += '"Client Name","Start Time","End Time","Break Time","Worked Hours","Rate/h","Amount","Note"\n'
    
    entries.forEach((entry) => {
      const clockInStr = entry.clockIn ? formatDateTimeForCSV(entry.clockIn) : ''
      const clockOutStr = entry.clockOut ? formatDateTimeForCSV(entry.clockOut) : ''
      
      // Calculate total break minutes
      const totalBreakMinutes = entry.breaks.reduce((sum, b) => {
        return sum + (b.duration || 0)
      }, 0)
      const breakTimeStr = totalBreakMinutes > 0 ? formatBreakTime(totalBreakMinutes) : '0h 00m'
      
      // Calculate worked hours
      let workedHours = '0:00'
      if (entry.clockIn && entry.clockOut) {
        const diffMs = entry.clockOut.getTime() - entry.clockIn.getTime()
        const diffMinutes = Math.floor((diffMs - (totalBreakMinutes * 60 * 1000)) / (1000 * 60))
        const hours = Math.floor(diffMinutes / 60)
        const minutes = diffMinutes % 60
        workedHours = `${hours}:${minutes.toString().padStart(2, '0')}`
      }
      
      // Escape quotes in notes
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
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router


