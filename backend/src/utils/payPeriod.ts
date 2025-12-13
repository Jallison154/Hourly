export interface PayPeriod {
  start: Date
  end: Date
}

export interface Week {
  start: Date
  end: Date
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
    const day = date.getDate()
    const month = date.getMonth()
    const year = date.getFullYear()
    
    if (day >= payPeriodEndDay + 1) {
      // Current month's (endDay+1) to next month's endDay
      return {
        start: new Date(year, month, payPeriodEndDay + 1),
        end: new Date(year, month + 1, payPeriodEndDay, 23, 59, 59, 999)
      }
    } else {
      // Previous month's (endDay+1) to current month's endDay
      return {
        start: new Date(year, month - 1, payPeriodEndDay + 1),
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
 * Split pay period into weeks (Sunday-Saturday, 7 days each)
 */
export function getWeeksInPayPeriod(payPeriod: PayPeriod): Week[] {
  const weeks: Week[] = []
  const start = new Date(payPeriod.start)
  const end = new Date(payPeriod.end)
  
  // Find the Sunday of the week containing the start date
  const startSunday = getWeekStartSunday(start)
  
  // If the pay period starts after Sunday, use the pay period start
  // Otherwise, use the Sunday
  const firstWeekStart = start > startSunday ? new Date(start) : new Date(startSunday)
  
  let currentWeekStart = getWeekStartSunday(firstWeekStart)
  let weekNumber = 1
  
  while (currentWeekStart <= end) {
    const weekEnd = getWeekEndSaturday(currentWeekStart)
    
    // Don't extend beyond pay period end
    const actualWeekEnd = weekEnd > end ? new Date(end) : new Date(weekEnd)
    
    // Don't start before pay period start
    const actualWeekStart = currentWeekStart < start ? new Date(start) : new Date(currentWeekStart)
    
    weeks.push({
      start: actualWeekStart,
      end: actualWeekEnd,
      weekNumber
    })
    
    // Move to next Sunday (7 days later)
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
 * Get all pay periods for a user (for history)
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
