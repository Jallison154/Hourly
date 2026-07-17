import { describe, it, expect } from 'vitest'
import { overlapMinutes, workedMinutesInRange, breakMinutesInRange } from '../workedTime'

describe('workedTime', () => {
  it('computes interval overlap', () => {
    const a0 = new Date('2026-07-16T08:00:00Z')
    const a1 = new Date('2026-07-16T17:00:00Z')
    const b0 = new Date('2026-07-16T16:00:00Z')
    const b1 = new Date('2026-07-16T20:00:00Z')
    expect(overlapMinutes(a0, a1, b0, b1)).toBe(60)
  })

  it('clips break minutes to range (not full break total)', () => {
    const rangeStart = new Date('2026-07-16T00:00:00Z')
    const rangeEnd = new Date('2026-07-16T12:00:00Z')
    const breaks = [
      {
        startTime: new Date('2026-07-16T11:30:00Z'),
        endTime: new Date('2026-07-16T12:30:00Z'), // 30 min in range, 30 after
      },
    ]
    expect(breakMinutesInRange(breaks, rangeStart, rangeEnd)).toBe(30)
  })

  it('overnight shift: only hours inside range', () => {
    const clockIn = new Date('2026-07-15T22:00:00Z')
    const clockOut = new Date('2026-07-16T06:00:00Z')
    const dayStart = new Date('2026-07-16T00:00:00Z')
    const dayEnd = new Date('2026-07-16T23:59:59Z')
    const mins = workedMinutesInRange({
      clockIn,
      clockOut,
      rangeStart: dayStart,
      rangeEnd: dayEnd,
      totalBreakMinutes: 0,
    })
    expect(mins).toBe(6 * 60)
  })

  it('does not subtract full break when only part of shift is in range', () => {
    const clockIn = new Date('2026-07-15T20:00:00Z')
    const clockOut = new Date('2026-07-16T04:00:00Z') // 8h shift
    const dayStart = new Date('2026-07-16T00:00:00Z')
    const dayEnd = new Date('2026-07-16T23:59:59Z')
    const breaks = [
      {
        startTime: new Date('2026-07-15T22:00:00Z'),
        endTime: new Date('2026-07-15T22:30:00Z'), // entirely previous day
      },
    ]
    const mins = workedMinutesInRange({
      clockIn,
      clockOut,
      rangeStart: dayStart,
      rangeEnd: dayEnd,
      breaks,
      totalBreakMinutes: 30,
    })
    // 4 hours on Jul 16, break was previous day → 240 minutes
    expect(mins).toBe(4 * 60)
  })
})
