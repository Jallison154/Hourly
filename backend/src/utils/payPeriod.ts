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
 * Calculate the current pay period
 * For monthly: uses endDay (default 10) - period runs from (endDay+1) to endDay of next month
 * For weekly: uses Monday-Sunday weeks
 */
export function getCurrentPayPeriod(
  date: Date = new Date(),
  payPeriodType: string = 'monthly',
  payPeriodEndDay: number = 10
): PayPeriod {
  if (payPeriodType === 'weekly') {
    // Weekly: Monday to Sunday
    const dayOfWeek = date.getDay()
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Monday
    const monday = new Date(date.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    
    return {
      start: monday,
      end: sunday
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
 * Split pay period into weeks (Monday-Sunday)
 */
export function getWeeksInPayPeriod(payPeriod: PayPeriod): Week[] {
  const weeks: Week[] = []
  const start = new Date(payPeriod.start)
  const end = new Date(payPeriod.end)
  
  // Find the Monday of the week containing the start date
  const startMonday = new Date(start)
  const dayOfWeek = startMonday.getDay()
  const diff = startMonday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Adjust to Monday
  startMonday.setDate(diff)
  startMonday.setHours(0, 0, 0, 0)
  
  // If the pay period starts after Monday, use the pay period start
  if (start > startMonday) {
    startMonday.setTime(start.getTime())
  }
  
  let currentWeekStart = new Date(startMonday)
  let weekNumber = 1
  
  while (currentWeekStart <= end) {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6) // Sunday
    weekEnd.setHours(23, 59, 59, 999)
    
    // Don't extend beyond pay period end
    if (weekEnd > end) {
      weekEnd.setTime(end.getTime())
    }
    
    // Don't start before pay period start
    const weekStart = currentWeekStart < start ? new Date(start) : new Date(currentWeekStart)
    
    weeks.push({
      start: weekStart,
      end: weekEnd,
      weekNumber
    })
    
    // Move to next Monday
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


