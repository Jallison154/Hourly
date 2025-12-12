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

