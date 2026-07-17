/**
 * Shared interval / break / worked-time helpers for pay-period and week clipping.
 */

export interface TimeInterval {
  start: Date
  end: Date
}

export interface BreakInterval {
  startTime: Date
  endTime: Date | null
}

/** Overlap duration in milliseconds between two half-open/closed intervals [start, end]. */
export function overlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime())
  const end = Math.min(aEnd.getTime(), bEnd.getTime())
  return Math.max(0, end - start)
}

export function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  return overlapMs(aStart, aEnd, bStart, bEnd) / (1000 * 60)
}

/**
 * Minutes of break that fall inside [rangeStart, rangeEnd], using individual break times.
 * Open breaks (no endTime) are treated as ending at `now` (or clockOut if provided).
 */
export function breakMinutesInRange(
  breaks: BreakInterval[],
  rangeStart: Date,
  rangeEnd: Date,
  openBreakEnd: Date = new Date()
): number {
  let total = 0
  for (const b of breaks) {
    const end = b.endTime ?? openBreakEnd
    if (end <= b.startTime) continue
    total += overlapMinutes(b.startTime, end, rangeStart, rangeEnd)
  }
  return total
}

/**
 * Worked minutes for a shift clipped to [rangeStart, rangeEnd].
 * Prefer individual breaks; fall back to proportional totalBreakMinutes when breaks absent.
 */
export function workedMinutesInRange(options: {
  clockIn: Date
  clockOut: Date | null
  rangeStart: Date
  rangeEnd: Date
  breaks?: BreakInterval[]
  totalBreakMinutes?: number
  now?: Date
}): number {
  const now = options.now ?? new Date()
  const shiftEnd = options.clockOut ?? (now > options.rangeEnd ? options.rangeEnd : now)
  const overlap = overlapMinutes(options.clockIn, shiftEnd, options.rangeStart, options.rangeEnd)
  if (overlap <= 0) return 0

  let breakMins = 0
  if (options.breaks && options.breaks.length > 0) {
    breakMins = breakMinutesInRange(
      options.breaks,
      options.rangeStart,
      options.rangeEnd,
      options.clockOut ?? now
    )
  } else if (options.totalBreakMinutes && options.totalBreakMinutes > 0) {
    // Proportional fallback only when we lack individual break intervals
    const fullShiftMinutes = Math.max(
      0,
      (shiftEnd.getTime() - options.clockIn.getTime()) / (1000 * 60)
    )
    if (fullShiftMinutes > 0) {
      breakMins = options.totalBreakMinutes * (overlap / fullShiftMinutes)
    }
  }

  return Math.max(0, overlap - breakMins)
}

export function workedHoursInRange(options: Parameters<typeof workedMinutesInRange>[0]): number {
  return workedMinutesInRange(options) / 60
}
