# Week grouping diagnosis – Saturday PM entry in wrong week

## 1) All locations where week grouping happens

### Backend

| Location | What it does | Used by |
|----------|----------------|--------|
| **backend/src/utils/timezone.ts** | `getWeekStartSundayUtc`, `getWeekEndSaturdayUtc`, `getNextWeekStartSundayUtc`, `getWeekBoundsInTimezone` – week bounds in user TZ as UTC. | timesheet, metrics, payCalculator, getPayPeriodsForRangeInTimezone |
| **backend/src/utils/timezone.ts** | `getWeeksInPayPeriodInTimezone` – splits a pay period into weeks (Sun–Sat), returns `WeekBounds[]` with clipped start/end. | timesheet (via getWeeksInPayPeriodTz in payPeriod), getPayPeriodsForRangeInTimezone (weekly) |
| **backend/src/routes/timesheet.ts** | For each week: `getWeekBoundsInTimezone(week.start, userTimezone)` → `actualSunday`, `actualEndExclusive`, `actualSaturdayDisplay`. Filters entries with `e.clockIn >= actualSunday && e.clockIn < actualEndExclusive` and `e.clockIn >= week.start && e.clockIn <= week.end`. **This is the only place that assigns entries to a week for the Timesheet UI.** | Timesheet UI (response `timesheet.weeks[].entries`) |
| **backend/src/routes/metrics.ts** | `getWeekStartSundayUtc(entry.clockIn, tz)` then `weekKey = toLocalDayKey(sundayUtc, tz)`; aggregates `weeklyHours[weekKey]`. | Metrics / dashboard |
| **backend/src/utils/payCalculator.ts** | Same pattern: `getWeekStartSundayUtc(entry.clockIn, tz)`, `weekKey = toLocalDayKey(sundayUtc, tz)`; groups hours by week for overtime. | Pay calculation |
| **backend/src/routes/paycheck.ts** | Uses `week.start` / `week.end` from pay period weeks (from getWeeksInPayPeriodInTimezone); does **not** recompute week bounds; queries entries with `gte: week.start, lte: week.end`. | Paycheck estimate |
| **backend/src/routes/admin.ts** | `getDay()` / `getDate()` to compute “this week” Sunday–Saturday in **server local** (no user TZ). | Admin dashboard |
| **backend/src/utils/payPeriod.ts** | `getWeekStartSunday(date)`, `getWeekEndSaturday(sunday)` – **server local** (no TZ), used only for non-timezone pay period helpers. | Legacy/local pay period helpers |

### Frontend

| Location | What it does | Used by |
|----------|----------------|--------|
| **frontend/src/pages/Timesheet.tsx** | No week grouping. Renders `timesheet.weeks` and `week.entries` from the API. | Timesheet UI |
| **frontend/src/components/WeeklySummary.tsx** | `getDay()` / `getDate()` to compute Sunday–Saturday in **browser local**; requests entries with `sunday.toISOString()` / `saturday.toISOString()`; builds `dateKey` from `clockIn.getFullYear/Month/Date()`. | Weekly summary widget |
| **frontend/src/pages/Dashboard.tsx** | Week start/end via `getDay()` and `setDate` (browser local). | Dashboard |
| **frontend/src/utils/timesheetFormatter.ts** | No grouping; formats existing `week.start` / `week.end` for copy-paste. | Timesheet copy |

---

## 2) Which one is responsible for Timesheet UI

**Only one place assigns entries to weeks for the Timesheet:**

- **backend/src/routes/timesheet.ts** inside `getTimesheetData()`, in the `weeklyData = await Promise.all(weeks.map(async (week) => { ... }))` block:
  - It gets `fullWeek = getWeekBoundsInTimezone(week.start, userTimezone)` (so `actualSunday`, `actualEndExclusive`, `actualSaturdayDisplay`).
  - It builds `weekEntries` with:
    - `inWeekRange = e.clockIn >= actualSunday && e.clockIn < actualEndExclusive`
    - `inPayPeriodRange = e.clockIn >= week.start && e.clockIn <= week.end`
  - The same `actualSunday` / `actualEndExclusive` are used for the `allWeekEntries` Prisma query (`gte: actualSunday`, `lt: actualEndExclusive`).
  - Response `week.entries` is exactly `weekEntriesWithHours` (from `weekEntries`). The frontend only displays that list; it does no week grouping.

So if “Saturday Feb 21, 2026 6:45 PM local” appears in Week 3 instead of Week 2, the bug is in this backend logic (bounds or filter), not in the frontend.

---

## 3) Diagnostic changes (no business logic change)

- **File:** `backend/src/routes/timesheet.ts`
- **Change:** Added a temporary diagnostic block that runs when `WEEK_GROUPING_DIAG === true` (and there are entries and weeks).

**What it logs:**

1. **Per week (in order):**
   - `weekNumber`
   - `weekStart(local)` and `weekEndExclusive(local)` in user TZ (format `yyyy-MM-dd HH:mm:ss`)
   - `weekKey` = `toLocalDayKey(full.start, userTimezone)` (e.g. `2026-02-15`)
   - Same bounds in UTC for copy-paste

2. **Per entry (every entry in the pay period):**
   - `entry.id`
   - `clockIn(raw)` = `entry.clockIn.toISOString()`
   - `clockIn(local)` = formatted in user TZ
   - `entryDayKey` = `toLocalDayKey(entry.clockIn, userTimezone)` (e.g. `2026-02-21`)
   - `assignedWeek` = week number for which `entry.clockIn >= full.start && entry.clockIn < full.endExclusive`
   - `weekKey` = `toLocalDayKey(full.start, userTimezone)` for that week

**How to use it:**

1. Set profile timezone to the one you use (e.g. America/Denver).
2. Restart backend, open Timesheet for a period that includes Feb 14–Feb 21 and Feb 22–28.
3. In the backend console you’ll see:
   - `[TIMESHEET WEEK DIAG] Week bounds (user TZ = ...)` – for each week the inclusive start and exclusive end (local and UTC).
   - `[TIMESHEET WEEK DIAG] Per-entry: ...` – for each entry, which week it was assigned to and the weekKey.

**Example of what to check for “Saturday Feb 21, 2026 6:45 PM” → week Feb 14–21:**

- That entry should have:
  - `clockIn(local)` ≈ `February 21, 2026 at 6:45:00 PM` (or your TZ equivalent)
  - `entryDayKey` = `2026-02-21`
  - `assignedWeek` = 2 (the week that has weekKey `2026-02-15`, i.e. Sun Feb 15).
- If it shows `assignedWeek` = 3, then the **backend** is bucketing it into the next week; the log will show which `weekStart(local)` / `weekEndExclusive(local)` that week has, so you can see if the bug is:
  - `actualEndExclusive` for Week 2 too early (e.g. Saturday 00:00 instead of Sunday 00:00), or
  - `week.start` for Week 2/3 wrong (so `getWeekBoundsInTimezone(week.start, userTimezone)` returns wrong bounds).

**To turn off:** set `WEEK_GROUPING_DIAG = false` in `backend/src/routes/timesheet.ts`.

---

## 4) Summary

- **List of grouping locations:** see tables in §1 (backend + frontend).
- **Timesheet UI:** fed only by **backend/src/routes/timesheet.ts** (getTimesheetData week filter and Prisma query); frontend does no grouping.
- **Diagnostic:** added in **backend/src/routes/timesheet.ts** (no other files). Logs week bounds and per-entry assignment so you can see exactly which layer places “Saturday Feb 21 6:45 PM” in Week 2 vs Week 3.
