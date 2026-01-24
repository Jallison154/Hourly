/**
 * Calculate federal income tax based on 2024 brackets
 * Applies standard deduction before calculating tax
 */
export function calculateFederalTax(annualIncome: number, filingStatus: 'single' | 'married' = 'single'): number {
  // 2024 Standard Deductions
  const standardDeduction = filingStatus === 'married' ? 29200 : 14600
  
  // Calculate taxable income after standard deduction
  const taxableIncome = Math.max(0, annualIncome - standardDeduction)
  
  if (taxableIncome <= 0) return 0
  
  // 2024 Federal Tax Brackets (varies by filing status)
  const brackets = filingStatus === 'married' ? [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 }
  ] : [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 }
  ]
  
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

/**
 * Get default state tax rate for a state
 */
function getDefaultStateTaxRate(state: string | null | undefined): number {
  if (!state) return 0.059 // Default to Montana 5.9%
  
  // Common state tax rates (flat rates, as of 2024)
  const stateRates: { [key: string]: number } = {
    'MT': 0.059, // Montana
    'CA': 0.013, // California (varies by income, using average)
    'TX': 0.0,   // Texas (no state income tax)
    'FL': 0.0,   // Florida (no state income tax)
    'NY': 0.04,  // New York (varies, using average)
    'WA': 0.0,   // Washington (no state income tax)
    'NV': 0.0,   // Nevada (no state income tax)
    'TN': 0.0,   // Tennessee (no state income tax)
    'SD': 0.0,   // South Dakota (no state income tax)
    'WY': 0.0,   // Wyoming (no state income tax)
    'NH': 0.0,   // New Hampshire (no state income tax)
    'AK': 0.0,   // Alaska (no state income tax)
  }
  
  return stateRates[state.toUpperCase()] ?? 0.059 // Default to Montana if state not found
}

/**
 * Calculate Montana state tax using progressive brackets (2024/2025)
 * Applies Montana standard deduction before calculating tax
 * 4.7% on income up to $21,100 (single) or $42,200 (married)
 * 5.9% on income above those thresholds
 */
function calculateMontanaStateTax(annualIncome: number, filingStatus: 'single' | 'married' = 'single'): number {
  // Montana 2024 Standard Deductions (approximately)
  const standardDeduction = filingStatus === 'married' ? 11080 : 5540
  
  // Calculate taxable income after Montana standard deduction
  const taxableIncome = Math.max(0, annualIncome - standardDeduction)
  
  if (taxableIncome <= 0) return 0
  
  const threshold = filingStatus === 'married' ? 42200 : 21100
  const lowerRate = 0.047
  const upperRate = 0.059
  
  if (taxableIncome <= threshold) {
    return taxableIncome * lowerRate
  } else {
    const lowerBracketTax = threshold * lowerRate
    const upperBracketIncome = taxableIncome - threshold
    const upperBracketTax = upperBracketIncome * upperRate
    return lowerBracketTax + upperBracketTax
  }
}

/**
 * Calculate state tax
 */
export function calculateStateTax(
  annualIncome: number, 
  state: string | null | undefined, 
  customRate: number | null | undefined,
  filingStatus: 'single' | 'married' = 'single'
): number {
  // If custom rate is provided, use it (flat rate)
  if (customRate !== null && customRate !== undefined) {
    return annualIncome * customRate
  }
  
  // Use progressive brackets for Montana
  if (state && state.toUpperCase() === 'MT') {
    return calculateMontanaStateTax(annualIncome, filingStatus)
  }
  
  // For other states, use flat rate
  const rate = getDefaultStateTaxRate(state)
  return annualIncome * rate
}

/**
 * Calculate FICA taxes (Social Security + Medicare)
 * Social Security: 6.2% up to $168,600
 * Medicare: 1.45% (no cap)
 * Additional Medicare: 0.9% on income over $200,000
 */
export function calculateFICA(annualIncome: number): number {
  const socialSecurityWageBase = 168600
  const socialSecurityRate = 0.062
  const medicareRate = 0.0145
  const additionalMedicareThreshold = 200000
  const additionalMedicareRate = 0.009
  
  let fica = 0
  
  // Social Security (capped)
  const socialSecurityIncome = Math.min(annualIncome, socialSecurityWageBase)
  fica += socialSecurityIncome * socialSecurityRate
  
  // Medicare
  fica += annualIncome * medicareRate
  
  // Additional Medicare
  if (annualIncome > additionalMedicareThreshold) {
    fica += (annualIncome - additionalMedicareThreshold) * additionalMedicareRate
  }
  
  return fica
}

/**
 * Calculate net pay from gross pay
 */
export function calculateNetPay(
  grossPay: number, 
  annualGrossPay: number,
  state?: string | null,
  stateTaxRate?: number | null,
  filingStatus: 'single' | 'married' = 'single'
): {
  federalTax: number
  stateTax: number
  fica: number
  netPay: number
  socialSecurity: number
  medicare: number
  stateTaxRate: number // Return the rate used for display
} {
  // Calculate annual taxes with filing status
  const annualFederalTax = calculateFederalTax(annualGrossPay, filingStatus)
  const annualStateTax = calculateStateTax(annualGrossPay, state, stateTaxRate, filingStatus)
  const annualFICA = calculateFICA(annualGrossPay)
  
  // Calculate individual FICA components for display
  const socialSecurityWageBase = 168600
  const socialSecurityRate = 0.062
  const medicareRate = 0.0145
  
  const annualSocialSecurity = Math.min(annualGrossPay, socialSecurityWageBase) * socialSecurityRate
  const annualMedicare = annualGrossPay * medicareRate
  
  // Pro-rate to pay period
  const federalTax = annualGrossPay > 0 ? (annualFederalTax / annualGrossPay) * grossPay : 0
  const stateTax = annualGrossPay > 0 ? (annualStateTax / annualGrossPay) * grossPay : 0
  const fica = annualGrossPay > 0 ? (annualFICA / annualGrossPay) * grossPay : 0
  const socialSecurity = annualGrossPay > 0 ? (annualSocialSecurity / annualGrossPay) * grossPay : 0
  const medicare = annualGrossPay > 0 ? (annualMedicare / annualGrossPay) * grossPay : 0
  
  const netPay = grossPay - federalTax - stateTax - fica
  const usedStateTaxRate = stateTaxRate ?? getDefaultStateTaxRate(state)
  
  return {
    federalTax,
    stateTax,
    fica,
    netPay,
    socialSecurity,
    medicare,
    stateTaxRate: usedStateTaxRate
  }
}


