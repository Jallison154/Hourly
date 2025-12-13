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
      where: { id: req.userId! },
      select: {
        hourlyRate: true,
        overtimeRate: true,
        paycheckAdjustment: true,
        state: true,
        stateTaxRate: true
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
    
    // Log all entries for debugging and recalculate breaks from breaks array
    entries.forEach((e, idx) => {
      // Recalculate break minutes from breaks array to ensure accuracy
      const calculatedBreakMinutes = e.breaks.reduce((total, b) => {
        if (b.duration) return total + b.duration
        if (b.endTime) {
          const dur = Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000)
          return total + dur
        }
        return total
      }, 0)
      
      const hours = e.clockOut ? (e.clockOut.getTime() - e.clockIn.getTime()) / (1000 * 60 * 60) : 0
      const breakHours = calculatedBreakMinutes / 60
      const workedHours = hours - breakHours
      
      console.log(`Entry ${idx + 1}: ${e.clockIn.toISOString()} to ${e.clockOut?.toISOString() || 'N/A'}`)
      console.log(`  Total hours: ${hours.toFixed(4)}, Breaks: ${breakHours.toFixed(4)} (${calculatedBreakMinutes} min from ${e.breaks.length} breaks, stored: ${e.totalBreakMinutes} min), Worked: ${workedHours.toFixed(4)}`)
      if (calculatedBreakMinutes !== e.totalBreakMinutes) {
        console.log(`  ⚠️ WARNING: Stored break minutes (${e.totalBreakMinutes}) doesn't match calculated (${calculatedBreakMinutes})`)
      }
    })
    
    // Use calculated break minutes from breaks array for accuracy
    const calculation = calculatePayForEntries(
      entries.map(e => {
        // Recalculate break minutes from breaks array
        const calculatedBreakMinutes = e.breaks.reduce((total, b) => {
          if (b.duration) return total + b.duration
          if (b.endTime) {
            const dur = Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000)
            return total + dur
          }
          return total
        }, 0)
        
        return {
          clockIn: e.clockIn,
          clockOut: e.clockOut,
          totalBreakMinutes: calculatedBreakMinutes
        }
      }),
      rate,
      overtimeRate,
      user.state,
      user.stateTaxRate
    )
    
    console.log(`Before adjustment: Gross = $${calculation.grossPay.toFixed(2)}, Net = $${calculation.netPay.toFixed(2)}`)
    
    // Apply adjustment
    console.log(`Applying adjustment: $${adjustment}`)
    calculation.grossPay += adjustment
    calculation.netPay += adjustment
    console.log(`After adjustment: Gross = $${calculation.grossPay.toFixed(2)}, Net = $${calculation.netPay.toFixed(2)}`)
    console.log(`=== END PAYCHECK CALCULATION ===\n`)
    
    // Get weekly breakdown
    // For accurate weekly overtime, we need ALL entries in each week, even if they're from previous pay period
    const weeks = getWeeksInPayPeriod(payPeriod)
    const weeklyBreakdown = await Promise.all(weeks.map(async (week) => {
      // Calculate the actual Sunday-Saturday range for this week
      // This is important because week.start/end might be clipped to pay period boundaries
      // We need the full week to get all entries, including from previous pay period
      const weekStartDate = new Date(week.start)
      const dayOfWeek = weekStartDate.getDay()
      // Calculate days to subtract to get to Sunday (0=Sunday, 1=Monday, ..., 6=Saturday)
      // If it's Sunday (0), go back 0 days. Otherwise, go back dayOfWeek days.
      const daysToSunday = dayOfWeek === 0 ? 0 : dayOfWeek
      const actualSunday = new Date(weekStartDate)
      actualSunday.setDate(weekStartDate.getDate() - daysToSunday)
      actualSunday.setHours(0, 0, 0, 0)
      
      const actualSaturday = new Date(actualSunday)
      actualSaturday.setDate(actualSunday.getDate() + 6) // Saturday is 6 days after Sunday (7 days total: Sun to Sat)
      actualSaturday.setHours(23, 59, 59, 999)
      
      console.log(`Paycheck Week ${week.weekNumber}: Actual week range ${actualSunday.toISOString()} to ${actualSaturday.toISOString()} (pay period range: ${week.start.toISOString()} to ${week.end.toISOString()})`)
      
      // Get ALL entries for this week (full Sunday-Saturday), even if they're outside the current pay period
      // This ensures weekly overtime calculations are accurate
      const allWeekEntries = await prisma.timeEntry.findMany({
        where: {
          userId: req.userId!,
          clockIn: {
            gte: actualSunday,
            lte: actualSaturday
          },
          clockOut: { not: null }
        },
        include: {
          breaks: true
        }
      })
      
      console.log(`Paycheck Week ${week.weekNumber}: Found ${allWeekEntries.length} total entries for full week`)
      
      // Recalculate break minutes from breaks array for accuracy
      const weekCalculation = calculatePayForEntries(
        allWeekEntries.map(e => {
          // Recalculate break minutes from breaks array
          const calculatedBreakMinutes = e.breaks.reduce((total, b) => {
            if (b.duration) return total + b.duration
            if (b.endTime) {
              const dur = Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000)
              return total + dur
            }
            return total
          }, 0)
          
          return {
            clockIn: e.clockIn,
            clockOut: e.clockOut!,
            totalBreakMinutes: calculatedBreakMinutes
          }
        }),
        rate,
        overtimeRate,
        user.state,
        user.stateTaxRate
      )
      
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


