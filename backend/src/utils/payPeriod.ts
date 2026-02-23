import {
  getPayPeriodBoundsInTimezone,
  getWeeksInPayPeriodInTimezone,
  getPayPeriodsForRangeInTimezone as getPayPeriodsForRangeTz,
  type WeekBounds
} from './timezone'

export interface PayPeriod {
  start: Date
  end: Date
}

/** Canonical Sun–Sat week: start = Sunday 00:00, endExclusive = next Sunday 00:00, endDisplay = Saturday 23:59:59.999 (for labels). */
export interface Week {
  start: Date
  endExclusive: Date
  endDisplay: Date
  weekKey: string
  weekNumber: number
}

/**
 * Get the Sunday that starts the week for a given date
 * A week runs Sunday to Saturday (7 days)
 */
function getWeekStartSunday(date: Date): Date {
  const dayOfWeek = date.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
  const sunday = new Date(date)
  
  // Calculate days to subtract to get to Sunday
  // If it's Sunday (0), go back 0 days
  // Otherwise, go back dayOfWeek days
  const daysToSunday = dayOfWeek === 0 ? 0 : dayOfWeek
  sunday.setDate(date.getDate() - daysToSunday)
  sunday.setHours(0, 0, 0, 0)
  
  return sunday
}

/**
 * Get the Saturday that ends the week for a given Sunday
 * A week runs Sunday to Saturday (7 days)
 */
function getWeekEndSaturday(sunday: Date): Date {
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6) // Saturday is 6 days after Sunday
  saturday.setHours(23, 59, 59, 999)
  return saturday
}

/**
 * Calculate the current pay period
 * For monthly: uses endDay (default 10) - period runs from (endDay+1) to endDay of next month
 * For weekly: uses Sunday-Saturday weeks (7 days)
 */
export function getCurrentPayPeriod(
  date: Date = new Date(),
  payPeriodType: string = 'monthly',
  payPeriodEndDay: number = 10
): PayPeriod {
  if (payPeriodType === 'weekly') {
    // Weekly: Sunday to Saturday (7 days)
    const sunday = getWeekStartSunday(date)
    const saturday = getWeekEndSaturday(sunday)
    
    return {
      start: sunday,
      end: saturday
    }
  } else {
    // Monthly: (endDay+1) to endDay of next month
    // Example: If endDay is 10, period runs from 11th of one month to 10th of next month
    const day = date.getDate()
    const month = date.getMonth()
    const year = date.getFullYear()
    
    if (day > payPeriodEndDay) {
      // We're past the endDay, so current period is: this month's (endDay+1) to next month's endDay
      // Example: If today is Dec 15 and endDay is 10, period is Dec 11 to Jan 10
      return {
        start: new Date(year, month, payPeriodEndDay + 1, 0, 0, 0, 0),
        end: new Date(year, month + 1, payPeriodEndDay, 23, 59, 59, 999)
      }
    } else {
      // We're on or before the endDay, so current period is: previous month's (endDay+1) to this month's endDay
      // Example: If today is Dec 10 and endDay is 10, period is Nov 11 to Dec 10
      return {
        start: new Date(year, month - 1, payPeriodEndDay + 1, 0, 0, 0, 0),
        end: new Date(year, month, payPeriodEndDay, 23, 59, 59, 999)
      }
    }
  }
}

/**
 * Get pay period for a specific date
 */
export function getPayPeriodForDate(
  date: Date,
  payPeriodType: string = 'monthly',
  payPeriodEndDay: number = 10
): PayPeriod {
  return getCurrentPayPeriod(date, payPeriodType, payPeriodEndDay)
}

/**
 * Get current pay period boundaries in user timezone (returns UTC Date instants for DB queries).
 * Prefer this when user timezone is available.
 */
export function getCurrentPayPeriodInTimezone(
  referenceUtc: Date,
  payPeriodType: string,
  payPeriodEndDay: number,
  timezone: string | null | undefined
): PayPeriod {
  const tz = timezone && timezone.trim() ? timezone.trim() : 'UTC'
  const { start, end } = getPayPeriodBoundsInTimezone(referenceUtc, payPeriodType, payPeriodEndDay, tz)
  return { start, end }
}

/**
 * Split pay period into weeks (Sun–Sat) in user timezone. Returns UTC instants for each week's bounds.
 */
export function getWeeksInPayPeriodTz(
  payPeriod: PayPeriod,
  timezone: string | null | undefined
): Week[] {
  const tz = timezone && timezone.trim() ? timezone.trim() : 'UTC'
  const weeks: Week[] = getWeeksInPayPeriodInTimezone(payPeriod.start, payPeriod.end, tz).map(
    (w: WeekBounds) => ({
      start: w.start,
      endExclusive: w.endExclusive,
      endDisplay: w.endDisplay,
      weekKey: w.weekKey,
      weekNumber: w.weekNumber
    })
  )
  return weeks
}

/**
 * Split pay period into weeks (Sunday-Saturday, 7 days each). Legacy: uses server local time.
 * Returns canonical Sun–Sat weeks: start = Sunday 00:00, endExclusive = next Sunday 00:00, endDisplay = Saturday 23:59:59.999.
 */
export function getWeeksInPayPeriod(payPeriod: PayPeriod): Week[] {
  const weeks: Week[] = []
  const end = new Date(payPeriod.end)
  let currentWeekStart = getWeekStartSunday(payPeriod.start)
  let weekNumber = 1

  while (currentWeekStart <= end) {
    const weekEndSat = getWeekEndSaturday(currentWeekStart)
    const nextSunday = new Date(currentWeekStart)
    nextSunday.setDate(nextSunday.getDate() + 7)
    const weekKey = currentWeekStart.getFullYear() + '-' + String(currentWeekStart.getMonth() + 1).padStart(2, '0') + '-' + String(currentWeekStart.getDate()).padStart(2, '0')
    weeks.push({
      start: new Date(currentWeekStart.getTime()),
      endExclusive: nextSunday,
      endDisplay: weekEndSat,
      weekKey,
      weekNumber
    })
    currentWeekStart = new Date(currentWeekStart)
    currentWeekStart.setDate(currentWeekStart.getDate() + 7)
    weekNumber++
  }

  return weeks
}

/**
 * Check if a date falls within a pay period
 */
export function isDateInPayPeriod(date: Date, payPeriod: PayPeriod): boolean {
  return date >= payPeriod.start && date <= payPeriod.end
}

/**
 * Get all pay periods for a user (for history). Uses server local time (legacy).
 */
export function getPayPeriodsForRange(startDate: Date, endDate: Date): PayPeriod[] {
  const periods: PayPeriod[] = []
  let current = new Date(startDate)
  
  while (current <= endDate) {
    const period = getPayPeriodForDate(current)
    
    // Avoid duplicates
    const exists = periods.some(p => 
      p.start.getTime() === period.start.getTime() &&
      p.end.getTime() === period.end.getTime()
    )
    
    if (!exists) {
      periods.push(period)
    }
    
    // Move to next month
    current = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate())
  }
  
  return periods.sort((a, b) => a.start.getTime() - b.start.getTime())
}

/**
 * Get all pay periods overlapping a date range in user timezone (UTC instants).
 */
export function getPayPeriodsForRangeInTimezone(
  startDate: Date,
  endDate: Date,
  payPeriodType: string,
  payPeriodEndDay: number,
  timezone: string | null | undefined
): PayPeriod[] {
  const tz = timezone && timezone.trim() ? timezone.trim() : 'UTC'
  return getPayPeriodsForRangeTz(startDate, endDate, payPeriodType, payPeriodEndDay, tz)
}
