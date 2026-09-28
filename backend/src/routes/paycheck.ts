import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { z } from 'zod'
import prisma from '../utils/prisma'
import { getCurrentPayPeriodInTimezone, getWeeksInPayPeriodTz } from '../utils/payPeriod'
import { getEffectiveBreakMinutes } from '../utils/breakMinutes'
import { calculatePay, summarizePayPeriod } from '../utils/payCalculator'

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
      where: { id: req.userId! },
      select: {
        hourlyRate: true,
        overtimeRate: true,
        overtimeThresholdHours: true,
        paycheckAdjustment: true,
        state: true,
        stateTaxRate: true,
        payPeriodType: true,
        payPeriodEndDay: true,
        filingStatus: true,
        timezone: true
      }
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const rate = hourlyRate || user.hourlyRate
    const overtimeRate = user.overtimeRate || 1.5
    const otThreshold = user.overtimeThresholdHours || 40
    const adjustment = user.paycheckAdjustment || 0
    
    if (!rate) {
      return res.status(400).json({ error: 'Hourly rate not set' })
    }
    
    // If hours provided, calculate directly
    if (hours !== undefined) {
      const calculation = calculatePay(
        hours,
        rate,
        0,
        overtimeRate,
        user.state,
        user.stateTaxRate,
        (user.filingStatus === 'married' ? 'married' : 'single'),
        otThreshold,
        user.payPeriodType || 'monthly'
      )
      // Apply adjustment
      calculation.grossPay += adjustment
      calculation.netPay += adjustment
      return res.json({
        ...calculation,
        hourlyRate: rate,
        overtimeRate,
        hours,
        adjustment
      })
    }
    
    // Otherwise, calculate from time entries
    const tz = user.timezone ?? 'UTC'
    let payPeriod
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (start.getTime() > end.getTime()) {
        return res.status(400).json({ error: 'Start date must be before or equal to end date' })
      }
      payPeriod = { start, end }
    } else {
      payPeriod = getCurrentPayPeriodInTimezone(
        new Date(),
        user.payPeriodType || 'monthly',
        user.payPeriodEndDay ?? 10,
        tz
      )
    }
    
    const filingStatus = (user.filingStatus === 'married' ? 'married' : 'single') as 'single' | 'married'
    const weeks = getWeeksInPayPeriodTz(payPeriod, tz)
    const rangeStart = weeks.length > 0 ? weeks[0].start : payPeriod.start
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: req.userId!,
        clockIn: {
          gte: rangeStart,
          lte: payPeriod.end
        },
        clockOut: { not: null }
      },
      include: {
        breaks: true
      },
      orderBy: {
        clockIn: 'asc'
      }
    })

    const workedHours = (entry: (typeof entries)[number]) => {
      if (!entry.clockOut) return 0
      const span = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
      return Math.max(0, span - getEffectiveBreakMinutes(entry) / 60)
    }

    const summary = summarizePayPeriod({
      entries: entries.map((entry) => ({
        id: entry.id,
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        workedHours: workedHours(entry),
      })),
      weeks,
      periodStart: payPeriod.start,
      periodEnd: payPeriod.end,
      hourlyRate: rate,
      overtimeRate,
      overtimeThresholdHours: otThreshold,
      payPeriodType: user.payPeriodType || 'monthly',
      state: user.state,
      stateTaxRate: user.stateTaxRate,
      filingStatus,
      adjustment,
    })
    const calculation = summary.period

    const weeklyBreakdown = summary.weeks.map((weekPay) => {
      const week = weeks.find((item) => item.weekNumber === weekPay.weekNumber)
      const weekEntries = entries.filter((entry) => weekPay.entryIds.includes(entry.id))
      return {
        weekNumber: weekPay.weekNumber,
        start: week?.start.toISOString(),
        end: week?.endDisplay.toISOString(),
        entries: weekEntries.map((entry) => ({
          id: entry.id,
          clockIn: entry.clockIn.toISOString(),
          clockOut: entry.clockOut?.toISOString() || null,
          totalBreakMinutes: getEffectiveBreakMinutes(entry),
          notes: entry.notes,
          breaks: entry.breaks,
          hours: workedHours(entry),
        })),
        regularHours: weekPay.regularHours,
        overtimeHours: weekPay.overtimeHours,
        regularPay: weekPay.regularPay,
        overtimePay: weekPay.overtimePay,
        grossPay: weekPay.grossPay,
        federalTax: weekPay.federalTax,
        stateTax: weekPay.stateTax,
        fica: weekPay.fica,
        socialSecurity: weekPay.socialSecurity,
        medicare: weekPay.medicare,
        netPay: weekPay.netPay,
        stateTaxRate: weekPay.stateTaxRate,
        taxYear: weekPay.taxYear,
      }
    })
    
    res.json({
      ...calculation,
      hourlyRate: rate,
      overtimeRate,
      overtimeThresholdHours: otThreshold,
      taxYear: calculation.taxYear,
      adjustment,
      payPeriod: {
        start: payPeriod.start.toISOString(),
        end: payPeriod.end.toISOString()
      },
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


