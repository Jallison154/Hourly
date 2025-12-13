import { calculateNetPay } from './taxCalculator'

export interface PayCalculation {
  regularHours: number
  overtimeHours: number
  regularPay: number
  overtimePay: number
  grossPay: number
  federalTax: number
  stateTax: number
  fica: number
  netPay: number
  stateTaxRate?: number // The state tax rate used for calculations (for display)
}

/**
 * Calculate pay for a given number of hours and hourly rate
 * Overtime multiplier after 40 hours per week
 */
export function calculatePay(
  hours: number,
  hourlyRate: number,
  weeklyHours: number = 0,
  overtimeRate: number = 1.5,
  state?: string | null,
  stateTaxRate?: number | null
): PayCalculation {
  const regularHours = Math.min(hours, 40 - weeklyHours)
  const overtimeHours = Math.max(0, hours - regularHours)
  
  const regularPay = regularHours * hourlyRate
  const overtimePay = overtimeHours * hourlyRate * overtimeRate
  const grossPay = regularPay + overtimePay
  
  // Estimate annual income (assuming this pay period is typical)
  // This is a rough estimate - in reality, you'd need to track all pay periods
  const annualGrossPay = grossPay * 24 // Assuming 24 pay periods per year (monthly)
  
  const taxes = calculateNetPay(grossPay, annualGrossPay, state, stateTaxRate)
  
  return {
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    grossPay,
    ...taxes
  }
}

/**
 * Calculate pay for multiple entries with weekly overtime tracking
 */
export function calculatePayForEntries(
  entries: Array<{ clockIn: Date; clockOut: Date | null; totalBreakMinutes: number }>,
  hourlyRate: number,
  overtimeRate: number = 1.5,
  state?: string | null,
  stateTaxRate?: number | null
): PayCalculation {
  // Group entries by week
  const weeks: { [key: string]: number } = {}
  
  let totalHours = 0
  
  console.log(`\n=== PAY CALCULATION DEBUG ===`)
  console.log(`Processing ${entries.length} entries`)
  console.log(`Hourly Rate: $${hourlyRate}, Overtime Rate: ${overtimeRate}x`)
  
  for (const entry of entries) {
    if (!entry.clockOut) continue
    
    const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
    const breakHours = entry.totalBreakMinutes / 60
    const workedHours = hours - breakHours
    
    // Get week key (Sunday of the week)
    // A week runs Sunday to Saturday (7 days)
    const date = new Date(entry.clockIn)
    const dayOfWeek = date.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
    // Calculate days to subtract to get to Sunday
    // If it's Sunday (0), go back 0 days
    // Otherwise, go back dayOfWeek days
    const daysToSunday = dayOfWeek === 0 ? 0 : dayOfWeek
    const sunday = new Date(date)
    sunday.setDate(date.getDate() - daysToSunday)
    sunday.setHours(0, 0, 0, 0)
    const weekKey = sunday.toISOString()
    
    weeks[weekKey] = (weeks[weekKey] || 0) + workedHours
    totalHours += workedHours
    
    console.log(`Entry: ${entry.clockIn.toISOString()} to ${entry.clockOut.toISOString()}`)
    console.log(`  Total hours: ${hours.toFixed(4)}, Break hours: ${breakHours.toFixed(4)}, Worked hours: ${workedHours.toFixed(4)}`)
    console.log(`  Week: ${weekKey}, Week total so far: ${weeks[weekKey].toFixed(4)}`)
  }
  
  console.log(`\nTotal hours across all entries: ${totalHours.toFixed(4)}`)
  console.log(`Weeks breakdown:`)
  Object.entries(weeks).forEach(([weekKey, weekHours]) => {
    console.log(`  ${weekKey}: ${weekHours.toFixed(4)} hours`)
  })
  
  // Calculate pay with overtime
  let regularPay = 0
  let overtimePay = 0
  let regularHours = 0
  let overtimeHours = 0
  
  console.log(`\nCalculating pay per week:`)
  for (const [weekKey, weekHours] of Object.entries(weeks)) {
    if (weekHours <= 40) {
      const weekRegularPay = weekHours * hourlyRate
      regularHours += weekHours
      regularPay += weekRegularPay
      console.log(`  Week ${weekKey}: ${weekHours.toFixed(4)} hours (regular) = $${weekRegularPay.toFixed(2)}`)
    } else {
      const weekRegularPay = 40 * hourlyRate
      const weekOvertimeHours = weekHours - 40
      const weekOvertimePay = weekOvertimeHours * hourlyRate * overtimeRate
      regularHours += 40
      regularPay += weekRegularPay
      overtimeHours += weekOvertimeHours
      overtimePay += weekOvertimePay
      console.log(`  Week ${weekKey}: ${weekHours.toFixed(4)} hours (${40} regular + ${weekOvertimeHours.toFixed(4)} OT) = $${weekRegularPay.toFixed(2)} + $${weekOvertimePay.toFixed(2)} = $${(weekRegularPay + weekOvertimePay).toFixed(2)}`)
    }
  }
  
  const grossPay = regularPay + overtimePay
  
  console.log(`\nFinal calculation:`)
  console.log(`  Regular hours: ${regularHours.toFixed(4)} = $${regularPay.toFixed(2)}`)
  console.log(`  Overtime hours: ${overtimeHours.toFixed(4)} = $${overtimePay.toFixed(2)}`)
  console.log(`  Gross Pay: $${grossPay.toFixed(2)}`)
  console.log(`=== END PAY CALCULATION DEBUG ===\n`)
  
  // Estimate annual income
  const annualGrossPay = grossPay * 24 // Monthly pay periods
  
  const taxes = calculateNetPay(grossPay, annualGrossPay, state, stateTaxRate)
  
  return {
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    grossPay,
    ...taxes
  }
}


