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

/** How many paychecks of this type make up a year. Monthly is 12, weekly is 52. */
export function payPeriodsPerYear(payPeriodType?: string | null): number {
  return payPeriodType === 'weekly' ? 52 : 12
}

/**
 * Hours already worked in a week reduce the regular-time room left.
 * Only hours inside the paycheck are paid; earlier hours in that week still trigger overtime.
 */
export function splitOvertimeHours(
  hoursInPeriod: number,
  priorWeekHours: number,
  threshold: number
): { regularHours: number; overtimeHours: number } {
  const safeHours = Math.max(0, hoursInPeriod)
  const room = Math.max(0, threshold - Math.max(0, priorWeekHours))
  const regularHours = Math.min(safeHours, room)
  return { regularHours, overtimeHours: safeHours - regularHours }
}

/**
 * Calculate pay for a lump of hours.
 * Weekly periods overtime after the threshold. Monthly periods spread hours across the year
 * (about 4.33 weeks) so a normal month is not treated as one 40-hour week.
 */
export function calculatePay(
  hours: number,
  hourlyRate: number,
  weeklyHours: number = 0,
  overtimeRate: number = 1.5,
  state?: string | null,
  stateTaxRate?: number | null,
  filingStatus: 'single' | 'married' = 'single',
  overtimeThresholdHours: number = 40,
  payPeriodType: string = 'weekly'
): PayCalculation {
  const threshold = overtimeThresholdHours > 0 ? overtimeThresholdHours : 40
  const weeksInPeriod = 52 / payPeriodsPerYear(payPeriodType)
  const regularCap = threshold * weeksInPeriod
  const regularHours = Math.max(0, Math.min(hours, regularCap - weeklyHours))
  const overtimeHours = Math.max(0, hours - regularHours)

  const regularPay = mulHoursRate(regularHours, hourlyRate)
  const overtimePay = mulHoursRate(overtimeHours, hourlyRate * overtimeRate)
  const grossPay = roundMoney(regularPay + overtimePay)

  const annualGrossPay = grossPay * payPeriodsPerYear(payPeriodType)
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
  workweekStartDay: number = 0,
  payPeriodType: string = 'monthly'
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
  const annualGrossPay = grossPay * payPeriodsPerYear(payPeriodType)
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

export interface PayWeekBounds {
  start: Date
  endExclusive: Date
  weekNumber: number
}

export interface PayableEntry {
  id: string
  clockIn: Date
  clockOut: Date | null
  workedHours: number
}

export interface WeekPaySlice extends PayCalculation {
  weekNumber: number
  hoursInPeriod: number
  priorWeekHours: number
  entryIds: string[]
}

function payFromHours(
  regularHours: number,
  overtimeHours: number,
  hourlyRate: number,
  overtimeRate: number
) {
  const regularPay = mulHoursRate(regularHours, hourlyRate)
  const overtimePay = mulHoursRate(overtimeHours, hourlyRate * overtimeRate)
  return {
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    grossPay: roundMoney(regularPay + overtimePay),
  }
}

/**
 * One paycheck from the weeks that overlap it.
 * Hours before the period in the same week count toward the overtime threshold
 * but are not paid again. Taxes use 12 checks/year for monthly and 52 for weekly.
 * Week tax lines are shares of that one tax bill so they add back to the paycheck.
 */
export function summarizePayPeriod(input: {
  entries: PayableEntry[]
  weeks: PayWeekBounds[]
  periodStart: Date
  periodEnd: Date
  hourlyRate: number
  overtimeRate?: number
  overtimeThresholdHours?: number
  payPeriodType?: string | null
  state?: string | null
  stateTaxRate?: number | null
  filingStatus?: 'single' | 'married'
  adjustment?: number
}): { period: PayCalculation; weeks: WeekPaySlice[] } {
  const overtimeRate = input.overtimeRate ?? 1.5
  const threshold = (input.overtimeThresholdHours ?? 40) > 0 ? (input.overtimeThresholdHours ?? 40) : 40
  const filingStatus = input.filingStatus ?? 'single'
  const adjustment = input.adjustment ?? 0

  const slices = input.weeks.map((week) => {
    let hoursInPeriod = 0
    let priorWeekHours = 0
    const entryIds: string[] = []

    for (const entry of input.entries) {
      if (!entry.clockOut) continue
      if (entry.clockIn < week.start || entry.clockIn >= week.endExclusive) continue
      const inPeriod = entry.clockIn >= input.periodStart && entry.clockIn <= input.periodEnd
      if (inPeriod) {
        hoursInPeriod += Math.max(0, entry.workedHours)
        entryIds.push(entry.id)
      } else if (entry.clockIn < input.periodStart) {
        priorWeekHours += Math.max(0, entry.workedHours)
      }
    }

    const split = splitOvertimeHours(hoursInPeriod, priorWeekHours, threshold)
    const pay = payFromHours(split.regularHours, split.overtimeHours, input.hourlyRate, overtimeRate)
    return {
      weekNumber: week.weekNumber,
      hoursInPeriod,
      priorWeekHours,
      entryIds,
      ...pay,
    }
  })

  const regularHours = slices.reduce((sum, week) => sum + week.regularHours, 0)
  const overtimeHours = slices.reduce((sum, week) => sum + week.overtimeHours, 0)
  const regularPay = roundMoney(slices.reduce((sum, week) => sum + week.regularPay, 0))
  const overtimePay = roundMoney(slices.reduce((sum, week) => sum + week.overtimePay, 0))
  const earnedGross = roundMoney(regularPay + overtimePay)
  const annualGrossPay = earnedGross * payPeriodsPerYear(input.payPeriodType)
  const taxes = calculateNetPay(
    earnedGross,
    annualGrossPay,
    input.state,
    input.stateTaxRate,
    filingStatus
  )
  const weekCount = slices.length
  let adjustmentAssigned = 0
  const weekAdjustments = slices.map((_, index) => {
    if (weekCount === 0) return 0
    if (index === weekCount - 1) return roundMoney(adjustment - adjustmentAssigned)
    const share = roundMoney(adjustment / weekCount)
    adjustmentAssigned = roundMoney(adjustmentAssigned + share)
    return share
  })

  const weeks: WeekPaySlice[] = slices.map((week, index) => {
    const share = earnedGross > 0 ? week.grossPay / earnedGross : 0
    const federalTax = roundMoney(taxes.federalTax * share)
    const stateTax = roundMoney(taxes.stateTax * share)
    const fica = roundMoney(taxes.fica * share)
    const socialSecurity = roundMoney(taxes.socialSecurity * share)
    const medicare = roundMoney(taxes.medicare * share)
    const weekAdjustment = weekAdjustments[index] ?? 0
    const grossPay = roundMoney(week.grossPay + weekAdjustment)
    const netPay = roundMoney(grossPay - federalTax - stateTax - fica)
    return {
      ...week,
      grossPay,
      federalTax,
      stateTax,
      fica,
      socialSecurity,
      medicare,
      netPay,
      stateTaxRate: taxes.stateTaxRate,
      taxYear: taxes.taxYear,
    }
  })

  if (weeks.length > 0) {
    const last = weeks[weeks.length - 1]
    const sumExceptLast = (pick: (week: WeekPaySlice) => number) =>
      roundMoney(weeks.slice(0, -1).reduce((sum, week) => sum + pick(week), 0))
    last.federalTax = roundMoney(taxes.federalTax - sumExceptLast((week) => week.federalTax))
    last.stateTax = roundMoney(taxes.stateTax - sumExceptLast((week) => week.stateTax))
    last.fica = roundMoney(taxes.fica - sumExceptLast((week) => week.fica))
    last.socialSecurity = roundMoney(taxes.socialSecurity - sumExceptLast((week) => week.socialSecurity))
    last.medicare = roundMoney(taxes.medicare - sumExceptLast((week) => week.medicare))
    last.netPay = roundMoney(last.grossPay - last.federalTax - last.stateTax - last.fica)
    const weekGross = roundMoney(weeks.reduce((sum, week) => sum + week.grossPay, 0))
    const periodGross = roundMoney(earnedGross + adjustment)
    const grossDrift = roundMoney(periodGross - weekGross)
    if (grossDrift !== 0) {
      last.grossPay = roundMoney(last.grossPay + grossDrift)
      last.netPay = roundMoney(last.grossPay - last.federalTax - last.stateTax - last.fica)
    }
  }

  return {
    period: {
      regularHours,
      overtimeHours,
      regularPay,
      overtimePay,
      ...taxes,
      grossPay: roundMoney(earnedGross + adjustment),
      netPay: roundMoney(taxes.netPay + adjustment),
    },
    weeks,
  }
}
