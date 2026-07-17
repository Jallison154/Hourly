import { calculateNetPay } from './taxCalculator'
import { getWeekStartForDayUtc, toLocalDayKey, normalizeTimezone } from './timezone'
import { mulHoursRate, roundMoney } from './money'
import { workedHoursInRange, type BreakInterval } from './workedTime'

export interface PayCalculation {
  regularHours: number
  overtimeHours: number
  regularPay: number
  overtimePay: number
  grossPay: number
  federalTax: number
  stateTax: number
  fica: number
  socialSecurity: number
  medicare: number
  netPay: number
  stateTaxRate?: number
  taxYear?: number
}

export interface PaySettings {
  overtimeRate?: number
  overtimeThresholdHours?: number
  workweekStartDay?: number // 0=Sunday … 6=Saturday
  timezone?: string | null
  state?: string | null
  stateTaxRate?: number | null
  filingStatus?: 'single' | 'married'
}

/**
 * Calculate pay for a given number of hours against remaining weekly capacity.
 */
export function calculatePay(
  hours: number,
  hourlyRate: number,
  weeklyHours: number = 0,
  overtimeRate: number = 1.5,
  state?: string | null,
  stateTaxRate?: number | null,
  filingStatus: 'single' | 'married' = 'single',
  overtimeThresholdHours: number = 40
): PayCalculation {
  const threshold = overtimeThresholdHours > 0 ? overtimeThresholdHours : 40
  const regularHours = Math.max(0, Math.min(hours, threshold - weeklyHours))
  const overtimeHours = Math.max(0, hours - regularHours)

  const regularPay = mulHoursRate(regularHours, hourlyRate)
  const overtimePay = mulHoursRate(overtimeHours, hourlyRate * overtimeRate)
  const grossPay = roundMoney(regularPay + overtimePay)

  const annualGrossPay = grossPay * 24
  const taxes = calculateNetPay(grossPay, annualGrossPay, state, stateTaxRate, filingStatus)

  return {
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    grossPay,
    ...taxes,
  }
}

export type PayEntry = {
  clockIn: Date
  clockOut: Date | null
  totalBreakMinutes: number
  breaks?: BreakInterval[]
}

/**
 * Calculate pay for multiple entries with weekly overtime tracking.
 */
export function calculatePayForEntries(
  entries: PayEntry[],
  hourlyRate: number,
  overtimeRate: number = 1.5,
  state?: string | null,
  stateTaxRate?: number | null,
  filingStatus: 'single' | 'married' = 'single',
  timezone?: string | null,
  overtimeThresholdHours: number = 40,
  workweekStartDay: number = 0
): PayCalculation {
  const tz = normalizeTimezone(timezone ?? 'UTC')
  const threshold = overtimeThresholdHours > 0 ? overtimeThresholdHours : 40
  const startDay = ((workweekStartDay % 7) + 7) % 7
  const weeks: { [key: string]: number } = {}

  for (const entry of entries) {
    if (!entry.clockOut) continue

    const workedHours =
      entry.breaks && entry.breaks.length > 0
        ? workedHoursInRange({
            clockIn: entry.clockIn,
            clockOut: entry.clockOut,
            rangeStart: entry.clockIn,
            rangeEnd: entry.clockOut,
            breaks: entry.breaks,
            totalBreakMinutes: entry.totalBreakMinutes,
          })
        : (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60) -
          entry.totalBreakMinutes / 60

    const weekStart = getWeekStartForDayUtc(entry.clockIn, tz, startDay)
    const weekKey = toLocalDayKey(weekStart, tz)
    weeks[weekKey] = (weeks[weekKey] || 0) + Math.max(0, workedHours)
  }

  let regularPayCents = 0
  let overtimePayCents = 0
  let regularHours = 0
  let overtimeHours = 0

  for (const weekHours of Object.values(weeks)) {
    if (weekHours <= threshold) {
      regularHours += weekHours
      regularPayCents += Math.round(mulHoursRate(weekHours, hourlyRate) * 100)
    } else {
      const ot = weekHours - threshold
      regularHours += threshold
      overtimeHours += ot
      regularPayCents += Math.round(mulHoursRate(threshold, hourlyRate) * 100)
      overtimePayCents += Math.round(mulHoursRate(ot, hourlyRate * overtimeRate) * 100)
    }
  }

  const regularPay = roundMoney(regularPayCents / 100)
  const overtimePay = roundMoney(overtimePayCents / 100)
  const grossPay = roundMoney(regularPay + overtimePay)
  const annualGrossPay = grossPay * 24
  const taxes = calculateNetPay(grossPay, annualGrossPay, state, stateTaxRate, filingStatus)

  return {
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    grossPay,
    ...taxes,
  }
}
