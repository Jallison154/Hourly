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
 * Calculate Montana state tax (flat 5.9% as of 2024)
 */
export function calculateMontanaTax(annualIncome: number): number {
  return annualIncome * 0.059
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
export function calculateNetPay(grossPay: number, annualGrossPay: number): {
  federalTax: number
  stateTax: number
  fica: number
  netPay: number
} {
  // Calculate annual taxes
  const annualFederalTax = calculateFederalTax(annualGrossPay)
  const annualStateTax = calculateMontanaTax(annualGrossPay)
  const annualFICA = calculateFICA(annualGrossPay)
  
  // Pro-rate to pay period
  const federalTax = (annualFederalTax / annualGrossPay) * grossPay
  const stateTax = (annualStateTax / annualGrossPay) * grossPay
  const fica = (annualFICA / annualGrossPay) * grossPay
  
  const netPay = grossPay - federalTax - stateTax - fica
  
  return {
    federalTax,
    stateTax,
    fica,
    netPay
  }
}


