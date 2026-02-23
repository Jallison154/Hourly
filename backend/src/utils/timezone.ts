/**
 * Timezone utilities for period boundaries and day grouping.
 * All timestamps are stored and queried as UTC; we compute boundaries in user timezone
 * and convert to UTC for DB queries. Day keys are YYYY-MM-DD in user timezone.
 */
import { DateTime } from 'luxon'

const DEFAULT_TZ = 'UTC'

/**
 * Normalize timezone string for luxon; invalid or empty becomes UTC.
 */
export function normalizeTimezone(tz: string | null | undefined): string {
  if (!tz || typeof tz !== 'string' || tz.trim() === '') return DEFAULT_TZ
  const trimmed = tz.trim()
  try {
    DateTime.now().setZone(trimmed)
    return trimmed
  } catch {
    return DEFAULT_TZ
  }
}

/**
 * Get the local calendar day key (YYYY-MM-DD) for a UTC instant in the given timezone.
 * Used for grouping entries by day in user's local time.
 */
export function toLocalDayKey(utcDate: Date, timezone: string): string {
  const tz = normalizeTimezone(timezone)
  const dt = DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(tz)
  return dt.toISODate() ?? dt.toFormat('yyyy-MM-dd')
}

/**
 * Return the UTC instant for Sunday 00:00:00 in the given timezone on the week containing the given UTC date.
 * Week is Sunday–Saturday (Luxon's default week is Monday–Sunday, so we compute Sunday explicitly).
 */
export function getWeekStartSundayUtc(referenceUtc: Date, timezone: string): Date {
  const tz = normalizeTimezone(timezone)
  const dt = DateTime.fromJSDate(referenceUtc, { zone: 'utc' }).setZone(tz)
  // Luxon weekday: 1 = Monday, 7 = Sunday
  const sunday = dt.weekday === 7 ? dt.startOf('day') : dt.minus({ days: dt.weekday }).startOf('day')
  return sunday.toUTC().toJSDate()
}

/**
 * Return the UTC instant for Saturday 23:59:59.999 in the given timezone on the week containing the given UTC date.
 */
export function getWeekEndSaturdayUtc(referenceUtc: Date, timezone: string): Date {
  const tz = normalizeTimezone(timezone)
  const dt = DateTime.fromJSDate(referenceUtc, { zone: 'utc' }).setZone(tz)
  const sunday = dt.weekday === 7 ? dt.startOf('day') : dt.minus({ days: dt.weekday }).startOf('day')
  const saturday = sunday.plus({ days: 6 }).endOf('day')
  return saturday.toUTC().toJSDate()
}

/**
 * Current week (Sun–Sat) boundaries in user timezone, as UTC instants for DB queries.
 */
export function getWeekBoundsInTimezone(referenceUtc: Date, timezone: string): { start: Date; end: Date } {
  return {
    start: getWeekStartSundayUtc(referenceUtc, timezone),
    end: getWeekEndSaturdayUtc(referenceUtc, timezone)
  }
}

/**
 * Pay period boundaries in user timezone.
 * Weekly: Sun–Sat of current week.
 * Monthly: (payPeriodEndDay+1) 00:00 to payPeriodEndDay 23:59:59 of next month, in user TZ, returned as UTC.
 */
export function getPayPeriodBoundsInTimezone(
  referenceUtc: Date,
  payPeriodType: string,
  payPeriodEndDay: number,
  timezone: string
): { start: Date; end: Date } {
  const tz = normalizeTimezone(timezone)
  const ref = DateTime.fromJSDate(referenceUtc, { zone: 'utc' }).setZone(tz)

  if (payPeriodType === 'weekly') {
    return getWeekBoundsInTimezone(referenceUtc, timezone)
  }

  // Monthly: period runs (endDay+1) 00:00 to endDay 23:59:59 next month
  const year = ref.year
  const month = ref.month
  const day = ref.day

  const daysInMonth = (y: number, m: number) => DateTime.fromObject({ year: y, month: m }, { zone: tz }).endOf('month').day
  const endDayThisMonth = Math.min(payPeriodEndDay, daysInMonth(year, month))
  if (day > payPeriodEndDay) {
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const startDayThis = payPeriodEndDay + 1
    const startLocal = startDayThis <= daysInMonth(year, month)
      ? DateTime.fromObject({ year, month, day: startDayThis }, { zone: tz }).startOf('day')
      : DateTime.fromObject({ year: nextYear, month: nextMonth, day: 1 }, { zone: tz }).startOf('day')
    const endDayNext = Math.min(payPeriodEndDay, daysInMonth(nextYear, nextMonth))
    const endLocal = DateTime.fromObject(
      { year: nextYear, month: nextMonth, day: endDayNext },
      { zone: tz }
    ).endOf('day')
    return {
      start: startLocal.toUTC().toJSDate(),
      end: endLocal.toUTC().toJSDate()
    }
  } else {
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const startDayPrev = payPeriodEndDay + 1
    const startLocal = startDayPrev <= daysInMonth(prevYear, prevMonth)
      ? DateTime.fromObject({ year: prevYear, month: prevMonth, day: startDayPrev }, { zone: tz }).startOf('day')
      : DateTime.fromObject({ year, month, day: 1 }, { zone: tz }).startOf('day')
    const endLocal = DateTime.fromObject({ year, month, day: endDayThisMonth }, { zone: tz }).endOf('day')
    return {
      start: startLocal.toUTC().toJSDate(),
      end: endLocal.toUTC().toJSDate()
    }
  }
}

/**
 * Split a pay period (UTC start/end) into weeks (Sun–Sat) in user timezone.
 * Each week's start/end are UTC instants of Sunday 00:00 and Saturday 23:59:59 in user TZ.
 */
export interface WeekBounds {
  start: Date
  end: Date
  weekNumber: number
}

export function getWeeksInPayPeriodInTimezone(
  payPeriodStartUtc: Date,
  payPeriodEndUtc: Date,
  timezone: string
): WeekBounds[] {
  const tz = normalizeTimezone(timezone)
  const weeks: WeekBounds[] = []
  const startDt = DateTime.fromJSDate(payPeriodStartUtc, { zone: 'utc' }).setZone(tz)
  let current = startDt.weekday === 7 ? startDt.startOf('day') : startDt.minus({ days: startDt.weekday }).startOf('day')
  const periodEnd = DateTime.fromJSDate(payPeriodEndUtc, { zone: 'utc' }).setZone(tz)
  let weekNumber = 1

  while (current <= periodEnd) {
    const weekStartLocal = current
    const weekEndLocal = current.plus({ days: 6 }).endOf('day')
    const weekStartUtc = weekStartLocal.toUTC().toJSDate()
    const weekEndUtc = weekEndLocal.toUTC().toJSDate()
    const clipStart = payPeriodStartUtc.getTime() > weekStartUtc.getTime() ? payPeriodStartUtc : weekStartUtc
    const clipEnd = payPeriodEndUtc.getTime() < weekEndUtc.getTime() ? payPeriodEndUtc : weekEndUtc
    weeks.push({
      start: clipStart,
      end: clipEnd,
      weekNumber
    })
    current = current.plus({ days: 7 })
    weekNumber++
  }

  return weeks
}

/**
 * Check if a UTC instant falls within a pay period (UTC bounds).
 */
export function isDateInPayPeriodUtc(dateUtc: Date, periodStartUtc: Date, periodEndUtc: Date): boolean {
  return dateUtc >= periodStartUtc && dateUtc <= periodEndUtc
}

/**
 * List pay periods overlapping a UTC date range, using boundaries in the given timezone.
 * Used for timesheet period dropdown. Each period's start/end are UTC instants.
 */
export function getPayPeriodsForRangeInTimezone(
  rangeStartUtc: Date,
  rangeEndUtc: Date,
  payPeriodType: string,
  payPeriodEndDay: number,
  timezone: string
): Array<{ start: Date; end: Date }> {
  const tz = normalizeTimezone(timezone)
  const periods: Array<{ start: Date; end: Date }> = []
  const seen = new Set<string>()

  if (payPeriodType === 'weekly') {
    let current = getWeekStartSundayUtc(rangeStartUtc, timezone)
    while (current <= rangeEndUtc) {
      const weekEnd = getWeekEndSaturdayUtc(new Date(current), timezone)
      const key = `${current}-${weekEnd.getTime()}`
      if (!seen.has(key)) {
        seen.add(key)
        periods.push({ start: new Date(current), end: weekEnd })
      }
      current = new Date(current).getTime() + 7 * 24 * 60 * 60 * 1000
    }
    return periods.sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  const start = DateTime.fromJSDate(rangeStartUtc, { zone: 'utc' }).setZone(tz)
  let current = start.startOf('month')
  const end = DateTime.fromJSDate(rangeEndUtc, { zone: 'utc' }).setZone(tz)

  while (current <= end) {
    const ref = current.toJSDate()
    const period = getPayPeriodBoundsInTimezone(ref, 'monthly', payPeriodEndDay, timezone)
    const key = `${period.start.getTime()}-${period.end.getTime()}`
    if (!seen.has(key)) {
      seen.add(key)
      periods.push(period)
    }
    current = current.plus({ months: 1 })
  }

  return periods.sort((a, b) => a.start.getTime() - b.start.getTime())
}
