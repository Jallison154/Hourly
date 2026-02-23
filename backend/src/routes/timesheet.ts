import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import prisma from '../utils/prisma'
import { getCurrentPayPeriodInTimezone, getWeeksInPayPeriodTz, getPayPeriodsForRangeInTimezone, type PayPeriod } from '../utils/payPeriod'
import { getWeekBoundsInTimezone, toLocalDayKey, formatInTimezone } from '../utils/timezone'
import { getEffectiveBreakMinutes } from '../utils/breakMinutes'
import { calculatePayForEntries } from '../utils/payCalculator'

const router = express.Router()

console.log('Timesheet routes registered')

// Get list of available pay periods
// This route MUST come before /:startDate/:endDate to avoid route conflicts
router.get('/periods', authenticate, async (req: AuthRequest, res) => {
  console.log('GET /periods route hit')
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { payPeriodType: true, payPeriodEndDay: true, timezone: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const tz = user.timezone ?? 'UTC'

    // Get the earliest time entry to determine start date
    const earliestEntry = await prisma.timeEntry.findFirst({
      where: { userId: req.userId! },
      orderBy: { clockIn: 'asc' },
      select: { clockIn: true }
    })

    if (!earliestEntry) {
      const currentPeriod = getCurrentPayPeriodInTimezone(
        new Date(),
        user.payPeriodType || 'monthly',
        user.payPeriodEndDay ?? 10,
        tz
      )
      return res.json([{
        start: currentPeriod.start.toISOString(),
        end: currentPeriod.end.toISOString()
      }])
    }

    const startDate = new Date(earliestEntry.clockIn)
    const endDate = new Date()
    const periods = getPayPeriodsForRangeInTimezone(
      startDate,
      endDate,
      user.payPeriodType || 'monthly',
      user.payPeriodEndDay ?? 10,
      tz
    )

    // Sort by date (newest first)
    periods.sort((a, b) => b.start.getTime() - a.start.getTime())

    res.json(periods.map(p => ({
      start: p.start.toISOString(),
      end: p.end.toISOString()
    })))
  } catch (error) {
    console.error('Get pay periods error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get timesheet for current pay period
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { payPeriodType: true, payPeriodEndDay: true, timezone: true }
    })
    const tz = user?.timezone ?? 'UTC'
    const payPeriod = getCurrentPayPeriodInTimezone(
      new Date(),
      user?.payPeriodType || 'monthly',
      user?.payPeriodEndDay ?? 10,
      tz
    )
    return getTimesheetData(req, res, payPeriod, tz)
  } catch (error: any) {
    console.error('Get timesheet error:', error)
    console.error('Error details:', error?.message, error?.stack)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    })
  }
})

// Get timesheet for specific pay period
router.get('/:startDate/:endDate', authenticate, async (req: AuthRequest, res) => {
  try {
    console.log('Received timesheet request with params:', req.params)
    const startDateStr = decodeURIComponent(req.params.startDate)
    const endDateStr = decodeURIComponent(req.params.endDate)
    console.log('Decoded dates:', startDateStr, endDateStr)
    
    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)
    
    console.log('Parsed dates:', startDate.toISOString(), endDate.toISOString())
    
    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error('Invalid date format:', startDateStr, endDateStr)
      return res.status(400).json({ error: 'Invalid date format' })
    }
    if (startDate > endDate) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' })
    }
    const payPeriod = { start: startDate, end: endDate }
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { timezone: true }
    })
    return getTimesheetData(req, res, payPeriod, user?.timezone ?? 'UTC')
  } catch (error: any) {
    console.error('Get timesheet error:', error)
    console.error('Error details:', error?.message, error?.stack)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    })
  }
})

async function getTimesheetData(
  req: AuthRequest,
  res: express.Response,
  payPeriod: { start: Date; end: Date },
  userTimezone: string = 'UTC'
) {
  try {
    console.log('Getting timesheet data for period:', {
      start: payPeriod.start.toISOString(),
      end: payPeriod.end.toISOString(),
      timezone: userTimezone
    })
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        name: true,
        hourlyRate: true,
        overtimeRate: true,
        paycheckAdjustment: true,
        state: true,
        stateTaxRate: true,
        payPeriodType: true,
        payPeriodEndDay: true,
        filingStatus: true
      }
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Get time entries
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: req.userId!,
        clockIn: {
          gte: payPeriod.start,
          lte: payPeriod.end
        }
      },
      include: {
        breaks: true
      },
      orderBy: {
        clockIn: 'asc'
      }
    })
    
    const weeks = getWeeksInPayPeriodTz(payPeriod, userTimezone)

    // --- DIAGNOSTIC: week grouping (no business logic change) ---
    const WEEK_GROUPING_DIAG = true
    if (WEEK_GROUPING_DIAG && entries.length > 0 && weeks.length > 0) {
      console.log('[TIMESHEET WEEK DIAG] userTimezone=%s', userTimezone)
      weeks.forEach((w) => {
        const full = getWeekBoundsInTimezone(w.start, userTimezone)
        const startLocal = formatInTimezone(full.start, userTimezone, 'yyyy-MM-dd', 'HH:mm:ss')
        const endExclusiveLocal = formatInTimezone(full.endExclusive, userTimezone, 'yyyy-MM-dd', 'HH:mm:ss')
        const weekKey = toLocalDayKey(full.start, userTimezone)
        console.log(`  Week ${w.weekNumber}: weekStart(local)=${startLocal} weekEndExclusive(local)=${endExclusiveLocal} weekKey=${weekKey} | UTC [${full.start.toISOString()}, ${full.endExclusive.toISOString()})`)
      })
      console.log('[TIMESHEET WEEK DIAG] Per-entry: id, clockIn(raw), clockIn(user TZ), entryDayKey, assignedWeek, weekKey')
      entries.forEach((entry) => {
        const clockInRaw = entry.clockIn.toISOString()
        const clockInLocal = formatInTimezone(entry.clockIn, userTimezone)
        const entryDayKey = toLocalDayKey(entry.clockIn, userTimezone)
        let assignedWeek: number | null = null
        let assignedWeekKey: string | null = null
        weeks.forEach((w) => {
          const full = getWeekBoundsInTimezone(w.start, userTimezone)
          if (entry.clockIn >= full.start && entry.clockIn < full.endExclusive) {
            assignedWeek = w.weekNumber
            assignedWeekKey = toLocalDayKey(full.start, userTimezone)
          }
        })
        console.log(`  entry.id=${entry.id} | clockIn(raw)=${clockInRaw} | clockIn(local)=${clockInLocal} | entryDayKey=${entryDayKey} | assignedWeek=${assignedWeek} | weekKey=${assignedWeekKey}`)
      })
    }

    const completedEntries = entries.filter(e => e.clockOut !== null)
    const filingStatus = (user.filingStatus === 'married' ? 'married' : 'single') as 'single' | 'married'
    const payPeriodPay = calculatePayForEntries(
      completedEntries.map(e => ({
        clockIn: e.clockIn,
        clockOut: e.clockOut!,
        totalBreakMinutes: getEffectiveBreakMinutes(e)
      })),
      user.hourlyRate,
      user.overtimeRate || 1.5,
      user.state,
      user.stateTaxRate,
      filingStatus,
      userTimezone
    )
    
    // Use pay period's annual estimate for all weekly tax calculations
    const payPeriodAnnualGrossPay = payPeriodPay.grossPay * 24
    
    // Calculate weekly breakdowns
    const weeklyData = await Promise.all(weeks.map(async (week) => {
      const fullWeek = getWeekBoundsInTimezone(week.start, userTimezone)
      const actualSunday = fullWeek.start
      const actualEndExclusive = fullWeek.endExclusive
      const actualSaturdayDisplay = fullWeek.endDisplay
      const weekStartDay = toLocalDayKey(actualSunday, userTimezone)
      const weekEndDay = toLocalDayKey(actualSaturdayDisplay, userTimezone)

      console.log(`Week ${week.weekNumber}: Full week range [${actualSunday.toISOString()}, ${actualEndExclusive.toISOString()}) (pay period clip: ${week.start.toISOString()} to ${week.end.toISOString()})`)

      const weekEntries = entries
        .filter(e => {
          const inWeekRange = e.clockIn >= actualSunday && e.clockIn < actualEndExclusive
          const inPayPeriodRange = e.clockIn >= week.start && e.clockIn <= week.end
          return inWeekRange && inPayPeriodRange
        })
        .sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime())

      const allWeekEntries = await prisma.timeEntry.findMany({
        where: {
          userId: req.userId!,
          clockIn: {
            gte: actualSunday,
            lt: actualEndExclusive
          },
          clockOut: { not: null }
        },
        include: {
          breaks: true
        }
      })

      console.log(`Week ${week.weekNumber}: Found ${allWeekEntries.length} total entries (${weekEntries.length} from current pay period)`)
      
      // Calculate total hours for DISPLAY - only from entries in current pay period
      let weekHours = 0
      weekEntries.forEach(entry => {
        if (entry.clockOut) {
          const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
          const breakHours = getEffectiveBreakMinutes(entry) / 60
          const workedHours = hours - breakHours
          weekHours += workedHours
        }
      })
      const previousPayPeriodHours = allWeekEntries
        .filter(e => !weekEntries.some(we => we.id === e.id))
        .reduce((sum, entry) => {
          const hours = (entry.clockOut!.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
          const breakHours = getEffectiveBreakMinutes(entry) / 60
          return sum + (hours - breakHours)
        }, 0)
      
      // Calculate total hours for the FULL week (including previous pay period) for overtime determination
      const fullWeekHours = weekHours + previousPayPeriodHours
      
      // Map entries from current pay period for display (with hours calculated)
      // (Already sorted chronologically above)
      const weekEntriesWithHours = weekEntries.map(entry => {
        if (!entry.clockOut) {
          return {
            ...entry,
            hours: 0,
            breakHours: 0
          }
        }
        
        const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
        const breakHours = getEffectiveBreakMinutes(entry) / 60
        const workedHours = hours - breakHours
        return {
          ...entry,
          hours: workedHours,
          breakHours
        }
      })
      // Calculate pay for DISPLAYED entries only (matching the displayed hours)
      // Only count hours within the pay period, even if week spans pay period boundaries
      const hourlyRate = user.hourlyRate
      const overtimeRate = user.overtimeRate || 1.5
      
      let regularPay = 0
      let overtimePay = 0
      let regularHours = 0
      let overtimeHours = 0
      
      // Calculate pay based ONLY on hours in this pay period (weekHours)
      // Don't consider hours from outside the pay period
      if (weekHours <= 40) {
        // No overtime - all displayed hours are regular
        regularHours = weekHours
        regularPay = weekHours * hourlyRate
      } else {
        // Overtime applies - first 40 hours are regular, rest is overtime
        regularHours = 40
        overtimeHours = weekHours - 40
        regularPay = regularHours * hourlyRate
        overtimePay = overtimeHours * hourlyRate * overtimeRate
      }
      
      const grossPay = regularPay + overtimePay
      
      // Calculate taxes using the pay period's annual estimate (not the week's estimate)
      // This ensures consistent tax calculations across all weeks
      const { calculateNetPay } = await import('../utils/taxCalculator')
      const taxes = calculateNetPay(grossPay, payPeriodAnnualGrossPay, user.state, user.stateTaxRate, filingStatus)
      
      // Apply adjustment proportionally to weekly breakdown
      const totalWeeks = weeks.length
      const weeklyAdjustment = (user.paycheckAdjustment || 0) / totalWeeks
      
      const weekPay = {
        regularHours,
        overtimeHours,
        regularPay,
        overtimePay,
        grossPay: grossPay + weeklyAdjustment,
        federalTax: taxes.federalTax,
        stateTax: taxes.stateTax,
        fica: taxes.fica,
        netPay: taxes.netPay + weeklyAdjustment
      }
      
      console.log(`Week ${week.weekNumber}: Displayed hours = ${weekHours.toFixed(2)}, Full week hours = ${fullWeekHours.toFixed(2)}, Previous pay period hours = ${previousPayPeriodHours.toFixed(2)}, Regular = ${weekPay.regularHours.toFixed(2)}, Overtime = ${weekPay.overtimeHours.toFixed(2)}`)
      
      return {
        weekNumber: week.weekNumber,
        start: actualSunday.toISOString(),
        end: actualSaturdayDisplay.toISOString(),
        entries: weekEntriesWithHours,
        totalHours: weekHours,
        previousPayPeriodHours: previousPayPeriodHours, // Hours from previous pay period in this week
        pay: weekPay
      }
    }))
    
    // Calculate total hours
    let totalHours = 0
    entries.forEach(entry => {
      if (entry.clockOut) {
        const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
        const breakHours = getEffectiveBreakMinutes(entry) / 60
        totalHours += hours - breakHours
      }
    })
    
    res.json({
      payPeriod,
      user: {
        name: user.name,
        hourlyRate: user.hourlyRate,
        overtimeRate: user.overtimeRate || 1.5
      },
      weeks: weeklyData,
      totals: {
        totalHours,
        ...payPeriodPay
      },
      entries: entries.map(entry => {
        if (!entry.clockOut) {
          return {
            ...entry,
            hours: 0,
            breakHours: 0
          }
        }
        
        const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
        const breakHours = getEffectiveBreakMinutes(entry) / 60
        
        return {
          ...entry,
          hours: hours - breakHours,
          breakHours
        }
      })
    })
  } catch (error: any) {
    console.error('Timesheet data error:', error)
    console.error('Error stack:', error?.stack)
    console.error('Error message:', error?.message)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    })
  }
}

export default router


