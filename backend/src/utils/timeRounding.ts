/**
 * Round a date/time down to the previous interval
 * @param date - The date to round
 * @param intervalMinutes - The rounding interval in minutes (default: 5)
 * @returns The rounded date
 */
export function roundTimeDown(date: Date, intervalMinutes: number = 5): Date {
  const rounded = new Date(date)
  const minutes = rounded.getMinutes()
  const remainder = minutes % intervalMinutes
  
  // Round down to previous interval
  rounded.setMinutes(minutes - remainder)
  
  // Reset seconds and milliseconds
  rounded.setSeconds(0)
  rounded.setMilliseconds(0)
  
  return rounded
}

/**
 * Round a date/time up to the next interval
 * @param date - The date to round
 * @param intervalMinutes - The rounding interval in minutes (default: 5)
 * @returns The rounded date
 */
export function roundTimeUp(date: Date, intervalMinutes: number = 5): Date {
  const rounded = new Date(date)
  const minutes = rounded.getMinutes()
  const remainder = minutes % intervalMinutes
  
  if (remainder === 0) {
    // Already on an interval, keep it as is (don't round up)
    // This way if you clock in at exactly 8:05, it stays 8:05
    rounded.setMinutes(minutes)
  } else {
    // Round up to next interval
    rounded.setMinutes(minutes + (intervalMinutes - remainder))
  }
  
  // Reset seconds and milliseconds
  rounded.setSeconds(0)
  rounded.setMilliseconds(0)
  
  return rounded
}

/**
 * Round a date/time to the nearest interval (rounds up)
 * @param date - The date to round
 * @param intervalMinutes - The rounding interval in minutes (default: 5)
 * @returns The rounded date
 */
export function roundTime(date: Date, intervalMinutes: number = 5): Date {
  return roundTimeUp(date, intervalMinutes)
}

/**
 * Apply rounding to clock in times (rounds DOWN to previous interval)
 */
export function applyClockInRounding(
  date: Date,
  roundingInterval: number = 5
): Date {
  if (roundingInterval <= 0) {
    return date // No rounding
  }
  return roundTimeDown(date, roundingInterval)
}

/**
 * Apply rounding to clock out times (rounds UP to next interval)
 */
export function applyClockOutRounding(
  date: Date,
  roundingInterval: number = 5
): Date {
  if (roundingInterval <= 0) {
    return date // No rounding
  }
  return roundTimeUp(date, roundingInterval)
}

/**
 * Apply rounding to clock in/out times based on user's rounding interval
 * @deprecated Use applyClockInRounding or applyClockOutRounding instead
 */
export function applyTimeRounding(
  date: Date,
  roundingInterval: number = 5
): Date {
  if (roundingInterval <= 0) {
    return date // No rounding
  }
  return roundTimeUp(date, roundingInterval)
}

