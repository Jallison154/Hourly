/**
 * Timezone utility tests: day grouping, week boundaries, pay period boundaries, DST.
 * Run: npx tsx src/utils/__tests__/timezone.test.ts
 * Or with Node test runner: node --import tsx --test src/utils/__tests__/timezone.test.ts
 */
import assert from 'node:assert'
import {
  toLocalDayKey,
  getWeekStartSundayUtc,
  getWeekEndSaturdayUtc,
  getWeekBoundsInTimezone,
  getPayPeriodBoundsInTimezone,
  getWeeksInPayPeriodInTimezone
} from '../timezone'

const tzDenver = 'America/Denver'

// --- a) Entry near midnight local (e.g. 23:30–00:30) should split correctly ---
function testMidnightSplit() {
  // In America/Denver, 2025-01-15 06:30 UTC = 2025-01-14 23:30 local (previous day)
  const utc2330Local = new Date('2025-01-15T06:30:00.000Z')
  const dayKey2330 = toLocalDayKey(utc2330Local, tzDenver)
  assert.strictEqual(dayKey2330, '2025-01-14', '23:30 local should be 2025-01-14 in Denver')

  // 2025-01-15 07:30 UTC = 2025-01-15 00:30 local (next calendar day)
  const utc0030Local = new Date('2025-01-15T07:30:00.000Z')
  const dayKey0030 = toLocalDayKey(utc0030Local, tzDenver)
  assert.strictEqual(dayKey0030, '2025-01-15', '00:30 local should be 2025-01-15 in Denver')

  // Week: 23:30 on Tuesday local is still Tuesday → same week as Wednesday 00:30
  const weekStart2330 = getWeekStartSundayUtc(utc2330Local, tzDenver)
  const weekStart0030 = getWeekStartSundayUtc(utc0030Local, tzDenver)
  assert.strictEqual(
    weekStart2330.getTime(),
    weekStart0030.getTime(),
    'Tuesday 23:30 and Wednesday 00:30 local should be in same week (same Sunday)'
  )
  console.log('  [PASS] Midnight split: day keys and week boundaries correct')
}

// --- b) Entry on pay period boundary day (10th/11th) lands in correct period ---
function testPayPeriodBoundary() {
  // Monthly end day 10: period is 11th 00:00 to 10th 23:59:59 next month (in user TZ)
  // In Denver: Dec 11 00:00 local = Dec 11 07:00 UTC (winter); Jan 10 23:59:59 local = Jan 11 06:59:59 UTC
  const refOnDec10 = new Date('2025-12-10T20:00:00.000Z') // Dec 10 afternoon UTC = Dec 10 local in Denver
  const periodDec10 = getPayPeriodBoundsInTimezone(refOnDec10, 'monthly', 10, tzDenver)
  const periodStartDec = periodDec10.start
  const periodEndDec = periodDec10.end
  // Current period when "today" is Dec 10 local: Nov 11 to Dec 10
  assert.ok(periodStartDec.getTime() <= refOnDec10.getTime() && periodEndDec.getTime() >= refOnDec10.getTime())
  const refOnDec11 = new Date('2025-12-11T08:00:00.000Z') // Dec 11 morning UTC = Dec 11 local Denver
  const periodDec11 = getPayPeriodBoundsInTimezone(refOnDec11, 'monthly', 10, tzDenver)
  // Current period when "today" is Dec 11 local: Dec 11 to Jan 10
  assert.ok(periodDec11.start.getTime() <= refOnDec11.getTime() && periodDec11.end.getTime() >= refOnDec11.getTime())
  assert.ok(periodDec11.start.getTime() > periodDec10.start.getTime(), 'Dec 11 period should start after Dec 10 period')
  console.log('  [PASS] Pay period boundary (10th/11th): entries land in correct period')
}

// --- c) Entry on Sunday boundary lands in correct week for overtime ---
function testSundayBoundary() {
  // Sunday 00:00 in Denver: 2025-01-12 07:00 UTC (MST)
  const sundayMidnightUtc = new Date('2025-01-12T07:00:00.000Z')
  const weekBounds = getWeekBoundsInTimezone(sundayMidnightUtc, tzDenver)
  const dayKeySunday = toLocalDayKey(sundayMidnightUtc, tzDenver)
  assert.strictEqual(dayKeySunday, '2025-01-12', 'Sunday 00:00 local should be 2025-01-12')
  assert.strictEqual(
    toLocalDayKey(weekBounds.start, tzDenver),
    '2025-01-12',
    'Week start should be Sunday 2025-01-12 in local'
  )
  // Saturday 23:59:59 Denver = 2025-01-19 06:59:59 UTC (next day UTC)
  assert.strictEqual(
    toLocalDayKey(weekBounds.end, tzDenver),
    '2025-01-18',
    'Week end should be Saturday 2025-01-18 in local'
  )
  // Entry Saturday 23:30 local (Sunday 06:30 UTC) should still be in week ending Saturday
  const sat2330Utc = new Date('2025-01-19T06:30:00.000Z')
  const weekStartSat = getWeekStartSundayUtc(sat2330Utc, tzDenver)
  assert.strictEqual(toLocalDayKey(weekStartSat, tzDenver), '2025-01-12', 'Sat 23:30 local still in Jan 12–18 week')
  console.log('  [PASS] Sunday boundary: week boundaries correct for overtime')
}

// --- d) DST transition week does not mis-bucket entries ---
function testDSTTransition() {
  // Spring forward 2025: March 9, 2:00 AM → 3:00 AM in America/Denver
  // Before: 2025-03-09 09:00 UTC = 02:00 local (before DST). After: 10:00 UTC = 03:00 local
  const justBeforeDST = new Date('2025-03-09T09:00:00.000Z')   // 02:00 local
  const justAfterDST = new Date('2025-03-09T10:00:00.000Z')   // 03:00 local
  const dayBefore = toLocalDayKey(justBeforeDST, tzDenver)
  const dayAfter = toLocalDayKey(justAfterDST, tzDenver)
  assert.strictEqual(dayBefore, '2025-03-09')
  assert.strictEqual(dayAfter, '2025-03-09')
  const weekBefore = getWeekStartSundayUtc(justBeforeDST, tzDenver)
  const weekAfter = getWeekStartSundayUtc(justAfterDST, tzDenver)
  assert.strictEqual(weekBefore.getTime(), weekAfter.getTime(), 'Same calendar day and week across DST')
  console.log('  [PASS] DST transition: same day and week across spring forward')
}

function run() {
  console.log('Timezone tests (America/Denver)\n')
  testMidnightSplit()
  testPayPeriodBoundary()
  testSundayBoundary()
  testDSTTransition()
  console.log('\nAll timezone tests passed.')
}

run()
