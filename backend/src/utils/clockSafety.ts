const LONG_SHIFT_HOURS = 12
const FUTURE_SLACK_MS = 5 * 60 * 1000

export function collectClockWarnings(options: {
  clockIn?: Date
  clockOut?: Date | null
  now?: Date
}): string[] {
  const now = options.now ?? new Date()
  const warnings: string[] = []

  if (options.clockIn && options.clockIn.getTime() > now.getTime() + FUTURE_SLACK_MS) {
    warnings.push('Clock-in time is in the future.')
  }
  if (options.clockOut && options.clockOut.getTime() > now.getTime() + FUTURE_SLACK_MS) {
    warnings.push('Clock-out time is in the future.')
  }
  if (options.clockIn && options.clockOut) {
    const hours =
      (options.clockOut.getTime() - options.clockIn.getTime()) / (1000 * 60 * 60)
    if (hours > LONG_SHIFT_HOURS) {
      warnings.push(`This shift is longer than ${LONG_SHIFT_HOURS} hours.`)
    }
    if (options.clockOut <= options.clockIn) {
      warnings.push('Clock-out is not after clock-in.')
    }
  } else if (options.clockIn && !options.clockOut) {
    const openHours = (now.getTime() - options.clockIn.getTime()) / (1000 * 60 * 60)
    if (openHours > LONG_SHIFT_HOURS) {
      warnings.push(`Open shift has been running longer than ${LONG_SHIFT_HOURS} hours.`)
    }
  }

  return warnings
}

export function validateBreakWithinShift(
  breakStart: Date,
  breakEnd: Date | null | undefined,
  clockIn: Date,
  clockOut: Date | null
): string | null {
  if (breakStart < clockIn) {
    return 'Break cannot start before the shift starts.'
  }
  if (clockOut && breakStart > clockOut) {
    return 'Break cannot start after the shift ends.'
  }
  if (breakEnd) {
    if (breakEnd <= breakStart) {
      return 'Break end must be after break start.'
    }
    if (clockOut && breakEnd > clockOut) {
      return 'Break cannot end after the shift ends.'
    }
  }
  return null
}
