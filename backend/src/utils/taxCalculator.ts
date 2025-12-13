/**
 * Calculate federal income tax based on 2024 brackets
 */
export function calculateFederalTax(annualIncome: number): number {
  // 2024 Federal Tax Brackets (Single filer)
  const brackets = [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 }
  ]
  
  let tax = 0
  let remainingIncome = annualIncome
  
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
 * Calculate state tax
 */
export function calculateStateTax(annualIncome: number, state: string | null | undefined, customRate: number | null | undefined): number {
  const rate = customRate ?? getDefaultStateTaxRate(state)
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
  stateTaxRate?: number | null
): {
  federalTax: number
  stateTax: number
  fica: number
  netPay: number
  stateTaxRate: number // Return the rate used for display
} {
  // Calculate annual taxes
  const annualFederalTax = calculateFederalTax(annualGrossPay)
  const annualStateTax = calculateStateTax(annualGrossPay, state, stateTaxRate)
  const annualFICA = calculateFICA(annualGrossPay)
  
  // Pro-rate to pay period
  const federalTax = (annualFederalTax / annualGrossPay) * grossPay
  const stateTax = (annualStateTax / annualGrossPay) * grossPay
  const fica = (annualFICA / annualGrossPay) * grossPay
  
  const netPay = grossPay - federalTax - stateTax - fica
  const usedStateTaxRate = stateTaxRate ?? getDefaultStateTaxRate(state)
  
  return {
    federalTax,
    stateTax,
    fica,
    netPay,
    stateTaxRate: usedStateTaxRate
  }
}


