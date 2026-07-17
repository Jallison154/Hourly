/** Integer-cent money helpers. Store/API still use dollar floats; calc in cents. */

export function toCents(dollars: number): number {
  if (!Number.isFinite(dollars)) return 0
  return Math.round(dollars * 100)
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

/** Round a dollar amount to 2 decimal places. */
export function roundMoney(dollars: number): number {
  return fromCents(toCents(dollars))
}

/**
 * hours * rate in cents, avoiding float drift.
 * hours may be fractional; rate is dollars/hour.
 */
export function mulHoursRateCents(hours: number, rateDollars: number): number {
  if (!Number.isFinite(hours) || !Number.isFinite(rateDollars) || hours <= 0) return 0
  // Work in 1/100 hour * cents for better precision, then round
  const hundredthsOfHour = Math.round(hours * 100)
  const rateCents = toCents(rateDollars)
  return Math.round((hundredthsOfHour * rateCents) / 100)
}

export function mulHoursRate(hours: number, rateDollars: number): number {
  return fromCents(mulHoursRateCents(hours, rateDollars))
}

export function addCents(...values: number[]): number {
  return values.reduce((a, b) => a + Math.round(b), 0)
}
