import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { z } from 'zod'
import prisma from '../utils/prisma'
import { getCurrentPayPeriod, getWeeksInPayPeriod } from '../utils/payPeriod'
import { calculatePay, calculatePayForEntries } from '../utils/payCalculator'

const router = express.Router()

const estimateSchema = z.object({
  hours: z.number().positive().optional(),
  hourlyRate: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
})

// Get paycheck estimate
router.get('/estimate', authenticate, async (req: AuthRequest, res) => {
  try {
    const { hours, hourlyRate, startDate, endDate } = estimateSchema.parse(req.query)
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: req.userId! }
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const rate = hourlyRate || user.hourlyRate
    const overtimeRate = user.overtimeRate || 1.5
    
    if (!rate) {
      return res.status(400).json({ error: 'Hourly rate not set' })
    }
    
    // If hours provided, calculate directly
    if (hours !== undefined) {
      const calculation = calculatePay(hours, rate, 0, overtimeRate)
      return res.json({
        ...calculation,
        hourlyRate: rate,
        overtimeRate,
        hours
      })
    }
    
    // Otherwise, calculate from time entries
    let payPeriod
    if (startDate && endDate) {
      payPeriod = { start: new Date(startDate), end: new Date(endDate) }
    } else {
      payPeriod = getCurrentPayPeriod(
        new Date(),
        user.payPeriodType || 'monthly',
        user.payPeriodEndDay || 10
      )
    }
    
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: req.userId!,
        clockIn: {
          gte: payPeriod.start,
          lte: payPeriod.end
        },
        clockOut: { not: null }
      }
    })
    
    const calculation = calculatePayForEntries(
      entries.map(e => ({
        clockIn: e.clockIn,
        clockOut: e.clockOut,
        totalBreakMinutes: e.totalBreakMinutes
      })),
      rate,
      overtimeRate
    )
    
    // Get weekly breakdown
    const weeks = getWeeksInPayPeriod(payPeriod)
    const weeklyBreakdown = weeks.map(week => {
      const weekEntries = entries.filter(e => {
        if (!e.clockOut) return false
        return e.clockIn >= week.start && e.clockIn <= week.end
      })
      
      const weekCalculation = calculatePayForEntries(
        weekEntries.map(e => ({
          clockIn: e.clockIn,
          clockOut: e.clockOut,
          totalBreakMinutes: e.totalBreakMinutes
        })),
        rate,
        overtimeRate
      )
      
      return {
        weekNumber: week.weekNumber,
        start: week.start,
        end: week.end,
        ...weekCalculation
      }
    })
    
    res.json({
      ...calculation,
      hourlyRate: rate,
      overtimeRate,
      payPeriod,
      weeklyBreakdown
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Paycheck estimate error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router


