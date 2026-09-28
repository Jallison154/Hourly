import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import prisma from '../utils/prisma'
import { getCurrentPayPeriodInTimezone, getWeeksInPayPeriodTz, getPayPeriodsForRangeInTimezone, type PayPeriod } from '../utils/payPeriod'
import { getEffectiveBreakMinutes } from '../utils/breakMinutes'
import { summarizePayPeriod } from '../utils/payCalculator'
import { toLocalDayKey, formatInTimezone, getWeekBucketForInstant } from '../utils/timezone'

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

// Export timesheet for specific pay period as CSV (daily clock-in/out with daily totals)
router.get('/export/:startDate/:endDate', authenticate, async (req: AuthRequest, res) => {
  try {
    const startDateStr = decodeURIComponent(req.params.startDate)
    const endDateStr = decodeURIComponent(req.params.endDate)

    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' })
    }
    if (startDate > endDate) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { timezone: true, name: true }
    })
    const userTimezone = user?.timezone ?? 'UTC'
    const userName = user?.name ?? 'Timesheet'

    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: req.userId!,
        clockIn: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        breaks: true
      },
      orderBy: {
        clockIn: 'asc'
      }
    })

    const safeStart = startDate.toISOString().slice(0, 10)
    const safeEnd = endDate.toISOString().slice(0, 10)
    const safeUserName = (userName || 'user')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'user'
    const csvEscape = (value: string | number | null | undefined): string => {
      const str = value === null || value === undefined ? '' : String(value)
      if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const formatHours = (hours: number): string => {
      const h = Math.floor(hours)
      const m = Math.round((hours - h) * 60)
      return `${h}:${m.toString().padStart(2, '0')}`
    }

    const rows: string[] = []
    // Header row only (no title row). Break sits between clock in and clock out.
    rows.push('Date,Clock In,Break,Clock Out,Hours Worked')

    // First pass: compute per-entry hours and week buckets
    const entrySummaries = entries
      .filter(e => e.clockOut) // only completed entries for export
      .map(e => {
        const breakMinutes = getEffectiveBreakMinutes(e)
        const hours = (e.clockOut!.getTime() - e.clockIn.getTime()) / (1000 * 60 * 60)
        const workedHours = hours - breakMinutes / 60
        const isoDayKey = toLocalDayKey(e.clockIn, userTimezone) // YYYY-MM-DD
        const [year, month, day] = isoDayKey.split('-')
        const dayKey = `${month}-${day}-${year}` // MM-DD-YYYY
        const weekBucket = getWeekBucketForInstant(e.clockIn, userTimezone)
        const weekKey = weekBucket.bucketKey // Sunday YYYY-MM-DD
        return { entry: e, breakMinutes, workedHours, dayKey, weekKey }
      })

    // Second pass: emit rows with per-week subtotals
    let grandTotalHours = 0
    let grandTotalBreakMinutes = 0
    let currentWeekKey: string | null = null
    let currentWeekTotal = 0
    let currentWeekBreakMinutes = 0

    entrySummaries.forEach(({ entry, breakMinutes, workedHours, dayKey, weekKey }) => {
      if (currentWeekKey !== null && weekKey !== currentWeekKey) {
        // Close previous week
        rows.push([
          'Week Total',
          '',
          csvEscape(formatHours(currentWeekBreakMinutes / 60)),
          '',
          csvEscape(formatHours(currentWeekTotal))
        ].join(','))
        rows.push('') // blank line between weeks
        currentWeekTotal = 0
        currentWeekBreakMinutes = 0
      }

      currentWeekKey = weekKey

      const clockInLocal = formatInTimezone(entry.clockIn, userTimezone, 'MM-dd-yyyy', 'HH:mm')
      const clockOutLocal = entry.clockOut
        ? formatInTimezone(entry.clockOut, userTimezone, 'MM-dd-yyyy', 'HH:mm')
        : ''

      currentWeekTotal += workedHours
      currentWeekBreakMinutes += breakMinutes
      grandTotalHours += workedHours
      grandTotalBreakMinutes += breakMinutes

      rows.push([
        csvEscape(dayKey),
        csvEscape(clockInLocal),
        csvEscape(formatHours(breakMinutes / 60)),
        csvEscape(clockOutLocal),
        csvEscape(formatHours(workedHours))
      ].join(','))
    })

    // Close final week total if any entries existed
    if (currentWeekKey !== null) {
      rows.push([
        'Week Total',
        '',
        csvEscape(formatHours(currentWeekBreakMinutes / 60)),
        '',
        csvEscape(formatHours(currentWeekTotal))
      ].join(','))
    }

    // Blank line and grand total row
    rows.push('')
    rows.push([
      'Totals',
      '',
      csvEscape(formatHours(grandTotalBreakMinutes / 60)),
      '',
      csvEscape(formatHours(grandTotalHours))
    ].join(','))

    const csv = rows.join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${safeUserName}-timesheet-${safeStart}_to_${safeEnd}.csv"`)
    res.send(csv)
  } catch (error) {
    console.error('Export timesheet CSV error:', error)
    res.status(500).json({ error: 'Internal server error' })
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
        overtimeThresholdHours: true,
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
    const otThreshold = user.overtimeThresholdHours || 40
    
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
    const filingStatus = (user.filingStatus === 'married' ? 'married' : 'single') as 'single' | 'married'
    const rangeStart = weeks.length > 0 ? weeks[0].start : payPeriod.start
    const spanEntries = await prisma.timeEntry.findMany({
      where: {
        userId: req.userId!,
        clockIn: { gte: rangeStart, lte: payPeriod.end },
        clockOut: { not: null }
      },
      include: { breaks: true }
    })
    const workedHoursFor = (entry: { clockIn: Date; clockOut: Date | null; breaks?: Array<{ duration?: number | null; endTime?: Date | null; startTime?: Date }>; totalBreakMinutes: number }) => {
      if (!entry.clockOut) return 0
      const span = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
      return Math.max(0, span - getEffectiveBreakMinutes(entry) / 60)
    }
    const paySummary = summarizePayPeriod({
      entries: spanEntries.map((entry) => ({
        id: entry.id,
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        workedHours: workedHoursFor(entry),
      })),
      weeks,
      periodStart: payPeriod.start,
      periodEnd: payPeriod.end,
      hourlyRate: user.hourlyRate,
      overtimeRate: user.overtimeRate || 1.5,
      overtimeThresholdHours: otThreshold,
      payPeriodType: user.payPeriodType || 'monthly',
      state: user.state,
      stateTaxRate: user.stateTaxRate,
      filingStatus,
      adjustment: user.paycheckAdjustment || 0,
    })
    const payPeriodPay = paySummary.period
    
    const weeklyData = weeks.map((week) => {
      const weekPaySlice = paySummary.weeks.find((item) => item.weekNumber === week.weekNumber)
      const weekEntries = entries
        .filter(e => {
          const inWeek = e.clockIn >= week.start && e.clockIn < week.endExclusive
          const inPayPeriod = e.clockIn >= payPeriod.start && e.clockIn <= payPeriod.end
          return inWeek && inPayPeriod
        })
        .sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime())

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
      const weekHours = weekPaySlice?.hoursInPeriod ?? 0
      const previousPayPeriodHours = weekPaySlice?.priorWeekHours ?? 0
      const weekPay = {
        regularHours: weekPaySlice?.regularHours ?? 0,
        overtimeHours: weekPaySlice?.overtimeHours ?? 0,
        regularPay: weekPaySlice?.regularPay ?? 0,
        overtimePay: weekPaySlice?.overtimePay ?? 0,
        grossPay: weekPaySlice?.grossPay ?? 0,
        federalTax: weekPaySlice?.federalTax ?? 0,
        stateTax: weekPaySlice?.stateTax ?? 0,
        fica: weekPaySlice?.fica ?? 0,
        netPay: weekPaySlice?.netPay ?? 0
      }

      return {
        weekNumber: week.weekNumber,
        start: week.start.toISOString(),
        end: week.endDisplay.toISOString(),
        entries: weekEntriesWithHours,
        totalHours: weekHours,
        previousPayPeriodHours,
        pay: weekPay
      }
    })
    
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


