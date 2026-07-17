import { describe, it, expect } from 'vitest'
import { toCents, fromCents, mulHoursRate, roundMoney } from '../money'
import { calculatePay, calculatePayForEntries } from '../payCalculator'

describe('money', () => {
  it('rounds to cents without float drift', () => {
    expect(toCents(19.99)).toBe(1999)
    expect(fromCents(1999)).toBe(19.99)
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  })

  it('multiplies hours × rate accurately', () => {
    expect(mulHoursRate(40, 25)).toBe(1000)
    expect(mulHoursRate(1.5, 33.33)).toBe(50)
  })

  it('calculatePay: 40h at $20 is $800 regular', () => {
    const pay = calculatePay(40, 20, 0, 1.5, 'TX', 0, 'single', 40)
    expect(pay.regularHours).toBe(40)
    expect(pay.overtimeHours).toBe(0)
    expect(pay.regularPay).toBe(800)
    expect(pay.grossPay).toBe(800)
  })

  it('calculatePay: 45h at $20 with 1.5x OT', () => {
    const pay = calculatePay(45, 20, 0, 1.5, 'TX', 0, 'single', 40)
    expect(pay.regularHours).toBe(40)
    expect(pay.overtimeHours).toBe(5)
    expect(pay.regularPay).toBe(800)
    expect(pay.overtimePay).toBe(150)
    expect(pay.grossPay).toBe(950)
  })

  it('respects custom overtime threshold', () => {
    const pay = calculatePay(45, 20, 0, 1.5, 'TX', 0, 'single', 50)
    expect(pay.regularHours).toBe(45)
    expect(pay.overtimeHours).toBe(0)
  })

  it('calculatePayForEntries aggregates weekly OT', () => {
    const monday = new Date('2026-07-13T15:00:00.000Z') // Mon morning UTC ~ Denver Sunday night-ish; use explicit week
    // Use a clear Sunday-week: Mon Jul 13 2026 09:00 Denver = 15:00 UTC
    const clockIn = new Date('2026-07-13T15:00:00.000Z')
    const clockOut = new Date(clockIn.getTime() + 45 * 60 * 60 * 1000)
    const pay = calculatePayForEntries(
      [{ clockIn, clockOut, totalBreakMinutes: 0 }],
      20,
      1.5,
      'TX',
      0,
      'single',
      'America/Denver',
      40,
      0
    )
    expect(pay.regularHours + pay.overtimeHours).toBeCloseTo(45, 5)
    expect(pay.overtimeHours).toBeCloseTo(5, 5)
    expect(pay.grossPay).toBeCloseTo(950, 2)
    void monday
  })
})
