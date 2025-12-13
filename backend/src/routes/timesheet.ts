import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import prisma from '../utils/prisma'
import { getCurrentPayPeriod, getWeeksInPayPeriod, getPayPeriodForDate, type PayPeriod } from '../utils/payPeriod'
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
      select: { payPeriodType: true, payPeriodEndDay: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get the earliest time entry to determine start date
    const earliestEntry = await prisma.timeEntry.findFirst({
      where: { userId: req.userId! },
      orderBy: { clockIn: 'asc' },
      select: { clockIn: true }
    })

    if (!earliestEntry) {
      // No entries yet, return current period only
      const currentPeriod = getCurrentPayPeriod(
        new Date(),
        user.payPeriodType || 'monthly',
        user.payPeriodEndDay || 10
      )
      return res.json([{
        start: currentPeriod.start.toISOString(),
        end: currentPeriod.end.toISOString()
      }])
    }

    // Generate pay periods from earliest entry to now
    const periods: PayPeriod[] = []
    const startDate = new Date(earliestEntry.clockIn)
    const endDate = new Date()
    
    // Get current period
    const currentPeriod = getCurrentPayPeriod(
      endDate,
      user.payPeriodType || 'monthly',
      user.payPeriodEndDay || 10
    )
    periods.push(currentPeriod)

    // Go backwards to get all periods since first entry
    if (user.payPeriodType === 'weekly') {
      // Weekly: go back week by week
      let current = new Date(currentPeriod.start)
      current.setDate(current.getDate() - 7) // Go back one week
      
      while (current >= startDate) {
        const period = getPayPeriodForDate(
          current,
          user.payPeriodType,
          user.payPeriodEndDay || 10
        )
        
        // Avoid duplicates
        const exists = periods.some(p => 
          p.start.getTime() === period.start.getTime() &&
          p.end.getTime() === period.end.getTime()
        )
        
        if (!exists) {
          periods.push(period)
        }
        
        current.setDate(current.getDate() - 7)
      }
    } else {
      // Monthly: go back month by month
      let current = new Date(currentPeriod.start)
      current.setMonth(current.getMonth() - 1) // Go back one month
      
      while (current >= startDate) {
        const period = getPayPeriodForDate(
          current,
          user.payPeriodType,
          user.payPeriodEndDay || 10
        )
        
        // Avoid duplicates
        const exists = periods.some(p => 
          p.start.getTime() === period.start.getTime() &&
          p.end.getTime() === period.end.getTime()
        )
        
        if (!exists) {
          periods.push(period)
        }
        
        current.setMonth(current.getMonth() - 1)
      }
    }

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
      select: { payPeriodType: true, payPeriodEndDay: true }
    })
    const payPeriod = getCurrentPayPeriod(
      new Date(),
      user?.payPeriodType || 'monthly',
      user?.payPeriodEndDay || 10
    )
    return getTimesheetData(req, res, payPeriod)
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
    
    const payPeriod = { start: startDate, end: endDate }
    return getTimesheetData(req, res, payPeriod)
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
  payPeriod: { start: Date; end: Date }
) {
  try {
    console.log('Getting timesheet data for period:', {
      start: payPeriod.start.toISOString(),
      end: payPeriod.end.toISOString()
    })
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: req.userId! }
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
    
    // Get weeks in pay period
    const weeks = getWeeksInPayPeriod(payPeriod)
    
    // Calculate weekly breakdowns
    const weeklyData = await Promise.all(weeks.map(async (week) => {
      // Calculate the actual Sunday-Saturday range for this week FIRST
      // This is important because week.start/end might be clipped to pay period boundaries
      // We need the full week to get all entries, including from previous pay period
      // Use the week.start date to find which Sunday-Saturday week it belongs to
      // If week.start is clipped (e.g., pay period starts on Wednesday), we need to find the Sunday of that week
      const weekStartDate = new Date(week.start)
      const dayOfWeek = weekStartDate.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
      
      // Calculate days to subtract to get to Sunday
      // If it's Sunday (0), go back 0 days. Otherwise, go back dayOfWeek days.
      const daysToSunday = dayOfWeek === 0 ? 0 : dayOfWeek
      const actualSunday = new Date(weekStartDate)
      actualSunday.setDate(weekStartDate.getDate() - daysToSunday)
      actualSunday.setHours(0, 0, 0, 0)
      
      const actualSaturday = new Date(actualSunday)
      actualSaturday.setDate(actualSunday.getDate() + 6) // Saturday is 6 days after Sunday (7 days total: Sun to Sat)
      actualSaturday.setHours(23, 59, 59, 999)
      
      console.log(`Week ${week.weekNumber}: Actual week range ${actualSunday.toISOString()} to ${actualSaturday.toISOString()} (pay period range: ${week.start.toISOString()} to ${week.end.toISOString()})`)
      
      // Get entries from current pay period that fall in this ACTUAL week (Sunday-Saturday)
      // But also respect pay period boundaries (week.start and week.end) for the first/last week
      // Sort by clockIn time for proper chronological order
      const weekEntries = entries
        .filter(e => {
          // Must be within the actual week range (Sunday-Saturday)
          const inWeekRange = e.clockIn >= actualSunday && e.clockIn <= actualSaturday
          // Also must be within the pay period boundaries for this week (clipped to pay period)
          const inPayPeriodRange = e.clockIn >= week.start && e.clockIn <= week.end
          return inWeekRange && inPayPeriodRange
        })
        .sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime())
      
      // Get ALL entries for this week (full Sunday-Saturday), even if they're outside the current pay period
      // This ensures weekly hours and overtime calculations are accurate
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
      
      console.log(`Week ${week.weekNumber}: Found ${allWeekEntries.length} total entries (${weekEntries.length} from current pay period)`)
      
      // Calculate total hours for DISPLAY - only from entries in current pay period
      let weekHours = 0
      weekEntries.forEach(entry => {
        if (entry.clockOut) {
          const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
          const breakHours = entry.totalBreakMinutes / 60
          const workedHours = hours - breakHours
          weekHours += workedHours
        }
      })
      
      // Calculate hours from previous pay period entries (entries not in current pay period)
      // This is needed for accurate overtime calculation
      const previousPayPeriodHours = allWeekEntries
        .filter(e => !weekEntries.some(we => we.id === e.id))
        .reduce((sum, entry) => {
          const hours = (entry.clockOut!.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
          const breakHours = entry.totalBreakMinutes / 60
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
        const breakHours = entry.totalBreakMinutes / 60
        const workedHours = hours - breakHours
        
        return {
          ...entry,
          hours: workedHours,
          breakHours
        }
      })
      
      // Calculate hours from previous pay period entries (entries not in current pay period)
      // This is needed for accurate overtime calculation
      const previousPayPeriodHours = allWeekEntries
        .filter(e => !weekEntries.some(we => we.id === e.id))
        .reduce((sum, entry) => {
          const hours = (entry.clockOut!.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
          const breakHours = entry.totalBreakMinutes / 60
          return sum + (hours - breakHours)
        }, 0)
      
      // Calculate total hours for the FULL week (including previous pay period) for overtime determination
      const fullWeekHours = weekHours + previousPayPeriodHours
      
      // Calculate pay for DISPLAYED entries only (matching the displayed hours)
      // But apply overtime rates based on the full week's hours for accuracy
      const hourlyRate = user.hourlyRate
      const overtimeRate = user.overtimeRate || 1.5
      
      let regularPay = 0
      let overtimePay = 0
      let regularHours = 0
      let overtimeHours = 0
      
      if (fullWeekHours <= 40) {
        // No overtime - all displayed hours are regular
        regularHours = weekHours
        regularPay = weekHours * hourlyRate
      } else {
        // Overtime applies - need to determine how much of displayed hours are overtime
        // Hours from previous pay period come first, then displayed hours
        const hoursBeforeDisplayed = previousPayPeriodHours
        
        if (hoursBeforeDisplayed >= 40) {
          // All displayed hours are overtime (previous pay period already exceeded 40)
          overtimeHours = weekHours
          overtimePay = weekHours * hourlyRate * overtimeRate
        } else {
          // Some displayed hours are regular, some are overtime
          const regularHoursInDisplayed = Math.max(0, 40 - hoursBeforeDisplayed)
          const overtimeHoursInDisplayed = Math.max(0, weekHours - regularHoursInDisplayed)
          
          regularHours = Math.min(weekHours, regularHoursInDisplayed)
          overtimeHours = overtimeHoursInDisplayed
          regularPay = regularHours * hourlyRate
          overtimePay = overtimeHours * hourlyRate * overtimeRate
        }
      }
      
      const grossPay = regularPay + overtimePay
      
      // Calculate taxes based on gross pay
      const annualGrossPay = grossPay * 24 // Estimate annual (monthly pay periods)
      const { calculateNetPay } = await import('../utils/taxCalculator')
      const taxes = calculateNetPay(grossPay, annualGrossPay, user.state, user.stateTaxRate)
      
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
        start: actualSunday.toISOString(), // Return full Sunday-Saturday range, not clipped pay period
        end: actualSaturday.toISOString(),
        entries: weekEntriesWithHours,
        totalHours: weekHours,
        previousPayPeriodHours: previousPayPeriodHours, // Hours from previous pay period in this week
        pay: weekPay
      }
    }))
    
    // Calculate pay period totals
    const completedEntries = entries.filter(e => e.clockOut !== null)
    const payPeriodPay = calculatePayForEntries(
      completedEntries.map(e => ({
        clockIn: e.clockIn,
        clockOut: e.clockOut!,
        totalBreakMinutes: e.totalBreakMinutes
      })),
      user.hourlyRate,
      user.overtimeRate || 1.5,
      user.state,
      user.stateTaxRate
    )
    
    // Calculate total hours
    let totalHours = 0
    entries.forEach(entry => {
      if (entry.clockOut) {
        const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
        const breakHours = entry.totalBreakMinutes / 60
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
        const breakHours = entry.totalBreakMinutes / 60
        
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


