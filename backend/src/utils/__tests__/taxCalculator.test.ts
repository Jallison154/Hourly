import { describe, it, expect } from 'vitest'
import {
  calculateFederalTax,
  calculateStateTax,
  calculateNetPay,
  ACTIVE_TAX_YEAR,
} from '../taxCalculator'

describe('taxCalculator', () => {
  it('exposes active tax year for UI', () => {
    expect(ACTIVE_TAX_YEAR).toBe(2024)
  })

  it('federal tax: income under standard deduction is zero', () => {
    expect(calculateFederalTax(10000, 'single')).toBe(0)
  })

  it('federal tax: known single bracket example', () => {
    // Taxable after $14,600 std deduction: $50,000 - $14,600 = $35,400
    // 10% of 11600 = 1160; 12% of (35400-11600)=23800 → 2856; total 4016
    const tax = calculateFederalTax(50000, 'single')
    expect(tax).toBeCloseTo(4016, 0)
  })

  it('Montana uses progressive brackets (not flat)', () => {
    const progressive = calculateStateTax(80000, 'MT', null, 'single')
    const flatCustom = calculateStateTax(80000, 'MT', 0.059, 'single')
    expect(progressive).toBeLessThan(flatCustom)
    expect(progressive).toBeGreaterThan(0)
  })

  it('net pay returns taxYear and rounds money', () => {
    const net = calculateNetPay(1000, 24000, 'TX', 0, 'single')
    expect(net.taxYear).toBe(2024)
    expect(Number.isFinite(net.netPay)).toBe(true)
    expect(net.netPay).toBeLessThanOrEqual(1000)
  })
})
