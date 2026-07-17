import {
  TAX_YEAR as FEDERAL_TAX_YEAR,
  FEDERAL_STANDARD_DEDUCTION,
  FEDERAL_BRACKETS,
  FICA,
  type FilingStatus,
} from '../tax/federal-2024'
import {
  TAX_YEAR as MT_TAX_YEAR,
  MT_STANDARD_DEDUCTION,
  MT_BRACKETS,
  OTHER_STATE_FLAT_RATES,
} from '../tax/montana-2024'
import { roundMoney } from './money'

/** Active estimate tax year shown in UI. Tables are 2024-era; results are estimates. */
export const ACTIVE_TAX_YEAR = FEDERAL_TAX_YEAR

export const TAX_ESTIMATE_DISCLAIMER =
  'Paycheck tax amounts are estimates only and may not match payroll withholding due to W-4 selections, pretax benefits, retirement deductions, dependents, additional withholding, local taxes, and employer payroll rules.'

/**
 * Calculate federal income tax based on versioned brackets.
 * Applies standard deduction before calculating tax.
 */
export function calculateFederalTax(
  annualIncome: number,
  filingStatus: FilingStatus = 'single'
): number {
  const standardDeduction = FEDERAL_STANDARD_DEDUCTION[filingStatus]
  const taxableIncome = Math.max(0, annualIncome - standardDeduction)
  if (taxableIncome <= 0) return 0

  const brackets = FEDERAL_BRACKETS[filingStatus]
  let tax = 0
  let remainingIncome = taxableIncome

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break
    const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min)
    tax += taxableInBracket * bracket.rate
    remainingIncome -= taxableInBracket
  }

  return tax
}

function getDefaultStateTaxRate(state: string | null | undefined): number {
  if (!state) return OTHER_STATE_FLAT_RATES.MT
  return OTHER_STATE_FLAT_RATES[state.toUpperCase()] ?? OTHER_STATE_FLAT_RATES.MT
}

/**
 * Montana progressive state tax (not a flat rate).
 */
function calculateMontanaStateTax(
  annualIncome: number,
  filingStatus: FilingStatus = 'single'
): number {
  const standardDeduction = MT_STANDARD_DEDUCTION[filingStatus]
  const taxableIncome = Math.max(0, annualIncome - standardDeduction)
  if (taxableIncome <= 0) return 0

  const threshold =
    filingStatus === 'married' ? MT_BRACKETS.thresholdMarried : MT_BRACKETS.thresholdSingle
  const { lowerRate, upperRate } = MT_BRACKETS

  if (taxableIncome <= threshold) {
    return taxableIncome * lowerRate
  }
  return threshold * lowerRate + (taxableIncome - threshold) * upperRate
}

export function calculateStateTax(
  annualIncome: number,
  state: string | null | undefined,
  customRate: number | null | undefined,
  filingStatus: FilingStatus = 'single'
): number {
  if (customRate !== null && customRate !== undefined) {
    return annualIncome * customRate
  }
  if (state && state.toUpperCase() === 'MT') {
    return calculateMontanaStateTax(annualIncome, filingStatus)
  }
  return annualIncome * getDefaultStateTaxRate(state)
}

export function calculateFICA(annualIncome: number): number {
  const {
    socialSecurityWageBase,
    socialSecurityRate,
    medicareRate,
    additionalMedicareThreshold,
    additionalMedicareRate,
  } = FICA

  let fica = Math.min(annualIncome, socialSecurityWageBase) * socialSecurityRate
  fica += annualIncome * medicareRate
  if (annualIncome > additionalMedicareThreshold) {
    fica += (annualIncome - additionalMedicareThreshold) * additionalMedicareRate
  }
  return fica
}

export function calculateNetPay(
  grossPay: number,
  annualGrossPay: number,
  state?: string | null,
  stateTaxRate?: number | null,
  filingStatus: FilingStatus = 'single'
): {
  federalTax: number
  stateTax: number
  fica: number
  netPay: number
  socialSecurity: number
  medicare: number
  stateTaxRate: number
  taxYear: number
} {
  const annualFederalTax = calculateFederalTax(annualGrossPay, filingStatus)
  const annualStateTax = calculateStateTax(annualGrossPay, state, stateTaxRate, filingStatus)
  const annualFICA = calculateFICA(annualGrossPay)

  const annualSocialSecurity =
    Math.min(annualGrossPay, FICA.socialSecurityWageBase) * FICA.socialSecurityRate
  const annualMedicare = annualGrossPay * FICA.medicareRate

  const scale = annualGrossPay > 0 ? grossPay / annualGrossPay : 0
  const federalTax = roundMoney(annualFederalTax * scale)
  const stateTax = roundMoney(annualStateTax * scale)
  const fica = roundMoney(annualFICA * scale)
  const socialSecurity = roundMoney(annualSocialSecurity * scale)
  const medicare = roundMoney(annualMedicare * scale)
  const netPay = roundMoney(grossPay - federalTax - stateTax - fica)

  return {
    federalTax,
    stateTax,
    fica,
    netPay,
    socialSecurity,
    medicare,
    stateTaxRate: stateTaxRate ?? getDefaultStateTaxRate(state),
    taxYear: Math.min(FEDERAL_TAX_YEAR, MT_TAX_YEAR),
  }
}
