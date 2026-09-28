import { describe, it, expect } from 'vitest'
import { toCents, fromCents, mulHoursRate, roundMoney } from '../money'
import { calculatePay, calculatePayForEntries, splitOvertimeHours, summarizePayPeriod } from '../payCalculator'

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

  it('annualizes a monthly check 12 times, so a $800 month has no federal tax', () => {
    const pay = calculatePay(40, 20, 0, 1.5, 'TX', 0, 'single', 40, 'monthly')
    expect(pay.regularHours).toBe(40)
    expect(pay.grossPay).toBe(800)
    expect(pay.federalTax).toBe(0)
    expect(pay.fica).toBe(61.2)
  })

  it('does not treat a normal month of hours as one overtime week', () => {
    const pay = calculatePay(80, 20, 0, 1.5, 'TX', 0, 'single', 40, 'monthly')
    expect(pay.regularHours).toBe(80)
    expect(pay.overtimeHours).toBe(0)
    expect(pay.grossPay).toBe(1600)
  })

  it('uses earlier hours in the same week before paying overtime', () => {
    expect(splitOvertimeHours(20, 30, 40)).toEqual({ regularHours: 10, overtimeHours: 10 })
  })

  it('summarizePayPeriod pays boundary overtime once and splits one tax bill across weeks', () => {
    const weekStart = new Date('2026-09-06T00:00:00.000Z')
    const nextWeek = new Date('2026-09-13T00:00:00.000Z')
    const periodStart = new Date('2026-09-11T00:00:00.000Z')
    const periodEnd = new Date('2026-09-19T23:59:59.000Z')
    const summary = summarizePayPeriod({
      entries: [
        {
          id: 'prior',
          clockIn: new Date('2026-09-07T12:00:00.000Z'),
          clockOut: new Date('2026-09-08T18:00:00.000Z'),
          workedHours: 30,
        },
        {
          id: 'current',
          clockIn: new Date('2026-09-11T12:00:00.000Z'),
          clockOut: new Date('2026-09-12T08:00:00.000Z'),
          workedHours: 20,
        },
      ],
      weeks: [
        { start: weekStart, endExclusive: nextWeek, weekNumber: 1 },
        { start: nextWeek, endExclusive: new Date('2026-09-20T00:00:00.000Z'), weekNumber: 2 },
      ],
      periodStart,
      periodEnd,
      hourlyRate: 20,
      overtimeRate: 1.5,
      overtimeThresholdHours: 40,
      payPeriodType: 'monthly',
      state: 'TX',
      stateTaxRate: 0,
      filingStatus: 'single',
      adjustment: 10,
    })

    expect(summary.weeks[0].priorWeekHours).toBe(30)
    expect(summary.weeks[0].regularHours).toBe(10)
    expect(summary.weeks[0].overtimeHours).toBe(10)
    expect(summary.weeks[0].regularPay).toBe(200)
    expect(summary.weeks[0].overtimePay).toBe(300)
    expect(summary.period.grossPay).toBe(510)
    expect(summary.period.federalTax).toBe(0)

    const weekGross = summary.weeks.reduce((sum, week) => sum + week.grossPay, 0)
    const weekFederal = summary.weeks.reduce((sum, week) => sum + week.federalTax, 0)
    const weekNet = summary.weeks.reduce((sum, week) => sum + week.netPay, 0)
    expect(roundMoney(weekGross)).toBe(summary.period.grossPay)
    expect(roundMoney(weekFederal)).toBe(summary.period.federalTax)
    expect(roundMoney(weekNet)).toBe(summary.period.netPay)
  })
})
