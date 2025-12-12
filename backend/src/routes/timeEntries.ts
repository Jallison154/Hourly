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
  clockOutTime: z.string().datetime().optional() // ISO string, defaults to now
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
    const { clockOutTime } = clockOutSchema.parse(req.body)
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
    const breakMinutes = openEntry.breaks.reduce((total, b) => {
      if (b.duration) return total + b.duration
      if (b.endTime) {
        const duration = Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000)
        return total + duration
      }
      return total
    }, 0)
    
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
    const overlapping = await prisma.timeEntry.findFirst({
      where: {
        userId: req.userId!,
        OR: [
          {
            clockIn: { lte: clockOutDate || new Date() },
            clockOut: { gte: clockInDate }
          },
          {
            clockIn: { lte: clockOutDate || new Date() },
            clockOut: null
          }
        ]
      }
    })
    
    if (overlapping) {
      return res.status(400).json({ error: 'Time entry overlaps with existing entry' })
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
    // Get user's pay period settings
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { payPeriodType: true, payPeriodEndDay: true }
    })
    const payPeriod = getCurrentPayPeriod(
      new Date(),
      user?.payPeriodType || 'monthly',
      user?.payPeriodEndDay || 10
    )
    
    const start = startDate ? new Date(startDate as string) : payPeriod.start
    const end = endDate ? new Date(endDate as string) : payPeriod.end
    
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

export default router


