/**
 * Single source of truth for break minutes in pay/hours calculations.
 * Use sum(breaks) when entry has breaks, else stored totalBreakMinutes.
 */
export function getEffectiveBreakMinutes(entry: {
  breaks?: Array<{ duration?: number | null; endTime?: Date | null; startTime?: Date }>
  totalBreakMinutes: number
}): number {
  if (entry.breaks && entry.breaks.length > 0) {
    return entry.breaks.reduce((total, b) => {
      if (b.duration != null) return total + b.duration
      if (b.endTime && b.startTime) {
        return total + Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000)
      }
      return total
    }, 0)
  }
  return entry.totalBreakMinutes
}
