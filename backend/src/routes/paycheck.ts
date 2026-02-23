import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { z } from 'zod'
import prisma from '../utils/prisma'
import { getCurrentPayPeriodInTimezone, getWeeksInPayPeriodTz } from '../utils/payPeriod'
import { getEffectiveBreakMinutes } from '../utils/breakMinutes'
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
      where: { id: req.userId! },
      select: {
        hourlyRate: true,
        overtimeRate: true,
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
    const adjustment = user.paycheckAdjustment || 0
    
    if (!rate) {
      return res.status(400).json({ error: 'Hourly rate not set' })
    }
    
    // If hours provided, calculate directly
    if (hours !== undefined) {
      const calculation = calculatePay(hours, rate, 0, overtimeRate, user.state, user.stateTaxRate)
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
    
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: req.userId!,
        clockIn: {
          gte: payPeriod.start,
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
    
    console.log(`\n=== PAYCHECK CALCULATION FOR PAY PERIOD ===`)
    console.log(`Pay period: ${payPeriod.start.toISOString()} to ${payPeriod.end.toISOString()}`)
    console.log(`Found ${entries.length} completed entries`)
    console.log(`Hourly rate: $${rate}, Overtime rate: ${overtimeRate}x, Adjustment: $${adjustment}`)
    
    entries.forEach((e, idx) => {
      const breakMin = getEffectiveBreakMinutes(e)
      const hours = e.clockOut ? (e.clockOut.getTime() - e.clockIn.getTime()) / (1000 * 60 * 60) : 0
      const workedHours = hours - breakMin / 60
      console.log(`Entry ${idx + 1}: ${e.clockIn.toISOString()} to ${e.clockOut?.toISOString() || 'N/A'}, worked: ${workedHours.toFixed(4)}h`)
    })
    const filingStatus = (user.filingStatus === 'married' ? 'married' : 'single') as 'single' | 'married'
    const calculation = calculatePayForEntries(
      entries.map(e => ({
        clockIn: e.clockIn,
        clockOut: e.clockOut,
        totalBreakMinutes: getEffectiveBreakMinutes(e)
      })),
      rate,
      overtimeRate,
      user.state,
      user.stateTaxRate,
      filingStatus,
      tz
    )
    
    console.log(`Before adjustment: Gross = $${calculation.grossPay.toFixed(2)}, Net = $${calculation.netPay.toFixed(2)}`)
    
    // Apply adjustment
    console.log(`Applying adjustment: $${adjustment}`)
    calculation.grossPay += adjustment
    calculation.netPay += adjustment
    console.log(`After adjustment: Gross = $${calculation.grossPay.toFixed(2)}, Net = $${calculation.netPay.toFixed(2)}`)
    console.log(`=== END PAYCHECK CALCULATION ===\n`)
    
    // Calculate the pay period's annual income estimate (use this for all weekly tax calculations)
    const payPeriodAnnualGrossPay = calculation.grossPay * 24 // Monthly pay periods
    
    // Get weekly breakdown (weeks in user timezone: Sun–Sat, UTC instants)
    const weeks = getWeeksInPayPeriodTz(payPeriod, tz)
    const weeklyBreakdown = await Promise.all(weeks.map(async (week) => {
      console.log(`Paycheck Week ${week.weekNumber}: Week range ${week.start.toISOString()} to ${week.end.toISOString()}`)
      
      // Get entries for this week, but ONLY those within the pay period
      // Only count hours that are in the pay period, even if week spans pay period boundaries
      const weekEntries = await prisma.timeEntry.findMany({
        where: {
          userId: req.userId!,
          clockIn: {
            gte: week.start, // Use pay period start, not actualSunday
            lte: week.end    // Use pay period end, not actualSaturday
          },
          clockOut: { not: null }
        },
        include: {
          breaks: true
        }
      })
      
      console.log(`Paycheck Week ${week.weekNumber}: Found ${weekEntries.length} entries within pay period`)
      
      // Calculate weekly gross pay (hours and pay only, no taxes yet)
      let weekHours = 0
      let weekRegularHours = 0
      let weekOvertimeHours = 0
      let weekRegularPay = 0
      let weekOvertimePay = 0
      
      weekEntries.forEach(e => {
        if (!e.clockOut) return
        const breakMin = getEffectiveBreakMinutes(e)
        const hours = (e.clockOut.getTime() - e.clockIn.getTime()) / (1000 * 60 * 60)
        const workedHours = hours - breakMin / 60
        
        weekHours += workedHours
      })
      
      // Calculate pay based ONLY on hours in this pay period
      if (weekHours <= 40) {
        weekRegularHours = weekHours
        weekRegularPay = weekHours * rate
      } else {
        weekRegularHours = 40
        weekOvertimeHours = weekHours - 40
        weekRegularPay = 40 * rate
        weekOvertimePay = weekOvertimeHours * rate * overtimeRate
      }
      
      const weekGrossPay = weekRegularPay + weekOvertimePay
      
      // Calculate taxes using the pay period's annual estimate (not the week's estimate)
      const { calculateNetPay } = await import('../utils/taxCalculator')
      const weekTaxes = calculateNetPay(weekGrossPay, payPeriodAnnualGrossPay, user.state, user.stateTaxRate, filingStatus)
      
      const weekCalculation = {
        regularHours: weekRegularHours,
        overtimeHours: weekOvertimeHours,
        regularPay: weekRegularPay,
        overtimePay: weekOvertimePay,
        grossPay: weekGrossPay,
        ...weekTaxes
      }
      
      console.log(`Paycheck Week ${week.weekNumber}: Total hours = ${(weekCalculation.regularHours + weekCalculation.overtimeHours).toFixed(2)}, Regular = ${weekCalculation.regularHours.toFixed(2)}, Overtime = ${weekCalculation.overtimeHours.toFixed(2)}, Gross = $${weekCalculation.grossPay.toFixed(2)}`)
      
      // Apply adjustment proportionally to weekly breakdown
      // Distribute adjustment evenly across weeks
      const totalWeeks = weeks.length
      const weeklyAdjustment = adjustment / totalWeeks
      weekCalculation.grossPay += weeklyAdjustment
      weekCalculation.netPay += weeklyAdjustment
      
      return {
        weekNumber: week.weekNumber,
        start: week.start.toISOString(),
        end: week.end.toISOString(),
        entries: weekEntries.map(e => {
          const breakMin = getEffectiveBreakMinutes(e)
          const hours = e.clockOut ? (e.clockOut.getTime() - e.clockIn.getTime()) / (1000 * 60 * 60) - breakMin / 60 : 0
          return {
            id: e.id,
            clockIn: e.clockIn.toISOString(),
            clockOut: e.clockOut?.toISOString() || null,
            totalBreakMinutes: breakMin,
            notes: e.notes,
            breaks: e.breaks,
            hours
          }
        }),
        ...weekCalculation
      }
    }))
    
    res.json({
      ...calculation,
      hourlyRate: rate,
      overtimeRate,
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


