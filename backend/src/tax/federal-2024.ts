/**
 * Federal income tax configuration — tax year 2024.
 * Labeled as estimate tables; not a substitute for payroll withholding.
 */
export const TAX_YEAR = 2024

export const FEDERAL_STANDARD_DEDUCTION = {
  single: 14600,
  married: 29200,
} as const

export type FilingStatus = 'single' | 'married'

export interface TaxBracket {
  min: number
  max: number
  rate: number
}

export const FEDERAL_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  married: [
    { min: 0, max: 23200, rate: 0.1 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
  single: [
    { min: 0, max: 11600, rate: 0.1 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
}

/** FICA constants for the same estimate year */
export const FICA = {
  socialSecurityWageBase: 168600,
  socialSecurityRate: 0.062,
  medicareRate: 0.0145,
  additionalMedicareThreshold: 200000,
  additionalMedicareRate: 0.009,
} as const
