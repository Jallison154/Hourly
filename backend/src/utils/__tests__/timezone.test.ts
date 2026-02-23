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
  getNextWeekStartSundayUtc,
  getWeekBoundsInTimezone,
  getWeekBucketForInstant,
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
  const sundayMidnightUtc = new Date('2025-01-12T07:00:00.000Z')
  const weekBounds = getWeekBoundsInTimezone(sundayMidnightUtc, tzDenver)
  const dayKeySunday = toLocalDayKey(sundayMidnightUtc, tzDenver)
  assert.strictEqual(dayKeySunday, '2025-01-12', 'Sunday 00:00 local should be 2025-01-12')
  assert.strictEqual(
    toLocalDayKey(weekBounds.start, tzDenver),
    '2025-01-12',
    'Week start should be Sunday 2025-01-12 in local'
  )
  assert.strictEqual(
    toLocalDayKey(weekBounds.endDisplay, tzDenver),
    '2025-01-18',
    'Week endDisplay should be Saturday 2025-01-18 in local'
  )
  const sat2330Utc = new Date('2025-01-19T06:30:00.000Z')
  const weekStartSat = getWeekStartSundayUtc(sat2330Utc, tzDenver)
  assert.strictEqual(toLocalDayKey(weekStartSat, tzDenver), '2025-01-12', 'Sat 23:30 local still in Jan 12–18 week')
  console.log('  [PASS] Sunday boundary: week boundaries correct for overtime')
}

// --- e) [start, nextSunday) exclusive: Saturday 23:59 stays in that week ---
function testSaturday2359StaysInWeek() {
  const tz = 'America/Denver'
  const sat2359Local = new Date('2026-02-22T06:59:59.999Z') // Denver: Feb 21 23:59:59
  const weekBounds = getWeekBoundsInTimezone(sat2359Local, tz)
  assert.ok(sat2359Local.getTime() >= weekBounds.start.getTime(), 'Sat 23:59 >= week start')
  assert.ok(sat2359Local.getTime() < weekBounds.endExclusive.getTime(), 'Sat 23:59 < next Sunday 00:00')
  console.log('  [PASS] Saturday 23:59 stays in that week ([start, endExclusive))')
}

// --- f) Sunday 00:00 belongs to next week ---
function testSundayMidnightNextWeek() {
  const tz = 'America/Denver'
  const sun0000Local = new Date('2026-02-22T07:00:00.000Z') // Denver: Feb 22 00:00 (Sunday)
  const weekBounds = getWeekBoundsInTimezone(sun0000Local, tz)
  assert.strictEqual(toLocalDayKey(weekBounds.start, tz), '2026-02-22', 'Week containing Sun 00:00 starts Feb 22')
  assert.ok(sun0000Local.getTime() >= weekBounds.start.getTime() && sun0000Local.getTime() < weekBounds.endExclusive.getTime(), 'Sun 00:00 in its week')
  const prevWeekSun = new Date(weekBounds.start.getTime() - 7 * 24 * 60 * 60 * 1000)
  const prevBounds = getWeekBoundsInTimezone(prevWeekSun, tz)
  assert.ok(sun0000Local.getTime() >= prevBounds.endExclusive.getTime(), 'Sun 00:00 is not in previous week')
  console.log('  [PASS] Sunday 00:00 belongs to next week')
}

// --- g) Entry crossing midnight Saturday: clockIn Saturday stays in week ---
function testMidnightSaturdaySplit() {
  const tz = 'America/Denver'
  const sat1159pm = new Date('2026-02-22T06:59:00.000Z') // Sat Feb 21 23:59 local
  const sun001am = new Date('2026-02-22T08:01:00.000Z')  // Sun Feb 22 01:01 local
  const weekBoundsSat = getWeekBoundsInTimezone(sat1159pm, tz)
  const weekBoundsSun = getWeekBoundsInTimezone(sun001am, tz)
  assert.ok(sat1159pm.getTime() >= weekBoundsSat.start.getTime() && sat1159pm.getTime() < weekBoundsSat.endExclusive.getTime(), 'Sat 23:59 in week')
  assert.ok(sun001am.getTime() >= weekBoundsSun.start.getTime() && sun001am.getTime() < weekBoundsSun.endExclusive.getTime(), 'Sun 01:01 in next week')
  assert.notStrictEqual(weekBoundsSat.start.getTime(), weekBoundsSun.start.getTime(), 'Different weeks')
  console.log('  [PASS] Entry crossing midnight Saturday split correctly')
}

// --- Canonical getWeekBucketForInstant: acceptance cases ---
function testWeekBucketFeb21_1845_local() {
  const tz = 'America/Denver'
  // Feb 21 2026 18:45 local Denver = Feb 22 01:45 UTC (MST UTC-7)
  const utc = new Date('2026-02-22T01:45:00.000Z')
  const bucket = getWeekBucketForInstant(utc, tz)
  assert.strictEqual(bucket.bucketKey, '2026-02-15', 'Feb 21 18:45 local => bucket starting Feb 15 (Sunday)')
  assert.strictEqual(toLocalDayKey(bucket.endExclusiveUtc, tz), '2026-02-22', 'Week ends exclusive Feb 22 (next Sunday 00:00 local)')
  console.log('  [PASS] Feb 21 2026 18:45 local => bucket Feb 15–Feb 22 (exclusive)')
}

function testWeekBucketFeb22_0000_local() {
  const tz = 'America/Denver'
  // Feb 22 2026 00:00 local = next week bucket (Sunday 00:00)
  const utc = new Date('2026-02-22T07:00:00.000Z')
  const bucket = getWeekBucketForInstant(utc, tz)
  assert.strictEqual(bucket.bucketKey, '2026-02-22', 'Feb 22 00:00 local => next week bucket (Feb 22)')
  console.log('  [PASS] Feb 22 2026 00:00 local => next week bucket')
}

function testWeekBucketSaturday2359_staysInWeek() {
  const tz = 'America/Denver'
  // Saturday 23:59:59.999 local = Feb 22 06:59:59.999 UTC (Feb 21 23:59:59.999 Denver)
  const utc = new Date('2026-02-22T06:59:59.999Z')
  const bucket = getWeekBucketForInstant(utc, tz)
  assert.strictEqual(bucket.bucketKey, '2026-02-15', 'Saturday 23:59:59.999 local stays in week starting Feb 15')
  assert.ok(utc.getTime() >= bucket.startUtc.getTime() && utc.getTime() < bucket.endExclusiveUtc.getTime(), 'Instant within [start, endExclusive)')
  console.log('  [PASS] Saturday up to 23:59:59.999 stays in same week')
}

// --- getWeeksInPayPeriodInTimezone: canonical Sun–Sat weeks ---
function testWeeksInPayPeriodSaturdayReturnsPriorSunday() {
  const tz = 'America/Denver'
  // Pay period that includes Saturday Feb 21, 2026: period e.g. Feb 11 – Mar 10
  const periodStart = new Date('2026-02-11T07:00:00.000Z')   // Feb 11 00:00 Denver
  const periodEnd = new Date('2026-03-11T06:59:59.999Z')    // Mar 10 23:59:59 Denver
  const weeks = getWeeksInPayPeriodInTimezone(periodStart, periodEnd, tz)
  const weekContainingSatFeb21 = weeks.find(w => w.weekKey === '2026-02-15')
  assert.ok(weekContainingSatFeb21, 'Week with key 2026-02-15 (Sun Feb 15) should exist')
  assert.strictEqual(toLocalDayKey(weekContainingSatFeb21!.start, tz), '2026-02-15', 'weekStart is Sunday Feb 15 local')
  assert.strictEqual(toLocalDayKey(weekContainingSatFeb21!.endExclusive, tz), '2026-02-22', 'weekEndExclusive is next Sunday Feb 22 local')
  const satFeb21_645pm = new Date('2026-02-22T01:45:00.000Z') // Feb 21 18:45 Denver
  assert.ok(satFeb21_645pm.getTime() >= weekContainingSatFeb21!.start.getTime() && satFeb21_645pm.getTime() < weekContainingSatFeb21!.endExclusive.getTime(), 'Feb 21 18:45 local in week 2026-02-15')
  console.log('  [PASS] Date on Saturday: weekStart = prior Sunday, weekKey 2026-02-15')
}

function testWeeksInPayPeriodEndExclusiveIsNextSunday() {
  const tz = 'America/Denver'
  const periodStart = new Date('2026-02-15T07:00:00.000Z')
  const periodEnd = new Date('2026-02-22T06:59:59.999Z')
  const weeks = getWeeksInPayPeriodInTimezone(periodStart, periodEnd, tz)
  assert.strictEqual(weeks.length, 1, 'One full week')
  assert.strictEqual(weeks[0].weekKey, '2026-02-15')
  assert.strictEqual(toLocalDayKey(weeks[0].endExclusive, tz), '2026-02-22', 'endExclusive is next Sunday')
  assert.strictEqual(toLocalDayKey(weeks[0].endDisplay, tz), '2026-02-21', 'endDisplay is Saturday')
  console.log('  [PASS] weekEndExclusive is next Sunday, endDisplay is Saturday')
}

function testWeeksInPayPeriodDSTWeekNoWrongDay() {
  const tz = 'America/Denver'
  // DST spring forward 2025: March 9. Week containing March 9 is Sun Mar 2 – Sat Mar 8 (or Mar 9 is Sunday? No, Mar 9 2025 is Sunday.)
  // So week containing March 9 starts March 9 00:00. Next week starts March 16.
  const periodStart = new Date('2025-03-01T07:00:00.000Z')   // Mar 1 00:00 Denver
  const periodEnd = new Date('2025-03-31T06:59:59.999Z')     // Mar 30 23:59 Denver
  const weeks = getWeeksInPayPeriodInTimezone(periodStart, periodEnd, tz)
  const weekMar9 = weeks.find(w => toLocalDayKey(w.start, tz) === '2025-03-09')
  assert.ok(weekMar9, 'Week starting March 9 (Sunday) exists')
  assert.strictEqual(toLocalDayKey(weekMar9!.start, tz), '2025-03-09', 'weekStart is Sunday March 9 local')
  assert.strictEqual(toLocalDayKey(weekMar9!.endExclusive, tz), '2025-03-16', 'weekEndExclusive is Sunday March 16 local')
  assert.strictEqual(toLocalDayKey(weekMar9!.endDisplay, tz), '2025-03-15', 'endDisplay is Saturday March 15')
  console.log('  [PASS] DST week: weekStart/End remain on correct days')
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
  testSaturday2359StaysInWeek()
  testSundayMidnightNextWeek()
  testMidnightSaturdaySplit()
  testWeekBucketFeb21_1845_local()
  testWeekBucketFeb22_0000_local()
  testWeekBucketSaturday2359_staysInWeek()
  testWeeksInPayPeriodSaturdayReturnsPriorSunday()
  testWeeksInPayPeriodEndExclusiveIsNextSunday()
  testWeeksInPayPeriodDSTWeekNoWrongDay()
  console.log('\nAll timezone tests passed.')
}

run()
