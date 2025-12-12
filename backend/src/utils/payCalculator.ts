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
}

/**
 * Calculate pay for a given number of hours and hourly rate
 * Overtime multiplier after 40 hours per week
 */
export function calculatePay(
  hours: number,
  hourlyRate: number,
  weeklyHours: number = 0,
  overtimeRate: number = 1.5
): PayCalculation {
  const regularHours = Math.min(hours, 40 - weeklyHours)
  const overtimeHours = Math.max(0, hours - regularHours)
  
  const regularPay = regularHours * hourlyRate
  const overtimePay = overtimeHours * hourlyRate * overtimeRate
  const grossPay = regularPay + overtimePay
  
  // Estimate annual income (assuming this pay period is typical)
  // This is a rough estimate - in reality, you'd need to track all pay periods
  const annualGrossPay = grossPay * 24 // Assuming 24 pay periods per year (monthly)
  
  const taxes = calculateNetPay(grossPay, annualGrossPay)
  
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
  overtimeRate: number = 1.5
): PayCalculation {
  // Group entries by week
  const weeks: { [key: string]: number } = {}
  
  let totalHours = 0
  
  for (const entry of entries) {
    if (!entry.clockOut) continue
    
    const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
    const breakHours = entry.totalBreakMinutes / 60
    const workedHours = hours - breakHours
    
    // Get week key (Monday of the week)
    const date = new Date(entry.clockIn)
    const dayOfWeek = date.getDay()
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const monday = new Date(date.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    const weekKey = monday.toISOString()
    
    weeks[weekKey] = (weeks[weekKey] || 0) + workedHours
    totalHours += workedHours
  }
  
  // Calculate pay with overtime
  let regularPay = 0
  let overtimePay = 0
  let regularHours = 0
  let overtimeHours = 0
  
  for (const weekHours of Object.values(weeks)) {
    if (weekHours <= 40) {
      regularHours += weekHours
      regularPay += weekHours * hourlyRate
    } else {
      regularHours += 40
      regularPay += 40 * hourlyRate
      overtimeHours += weekHours - 40
      overtimePay += (weekHours - 40) * hourlyRate * overtimeRate
    }
  }
  
  const grossPay = regularPay + overtimePay
  
  // Estimate annual income
  const annualGrossPay = grossPay * 24 // Monthly pay periods
  
  const taxes = calculateNetPay(grossPay, annualGrossPay)
  
  return {
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    grossPay,
    ...taxes
  }
}


