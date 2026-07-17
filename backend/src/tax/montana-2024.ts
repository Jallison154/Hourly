/**
 * Montana state income tax — progressive brackets for tax year 2024/2025 tables
 * used by this app. Not a flat rate.
 */
export const TAX_YEAR = 2024

export const MT_STANDARD_DEDUCTION = {
  single: 5540,
  married: 11080,
} as const

export const MT_BRACKETS = {
  thresholdSingle: 21100,
  thresholdMarried: 42200,
  lowerRate: 0.047,
  upperRate: 0.059,
} as const

/** Flat fallback rates for other states (approximate, estimate-only). */
export const OTHER_STATE_FLAT_RATES: Record<string, number> = {
  MT: 0.059, // display fallback only; MT uses progressive brackets
  CA: 0.013,
  TX: 0.0,
  FL: 0.0,
  NY: 0.04,
  WA: 0.0,
  NV: 0.0,
  TN: 0.0,
  SD: 0.0,
  WY: 0.0,
  NH: 0.0,
  AK: 0.0,
}
