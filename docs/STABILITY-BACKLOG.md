# Stability Backlog — Hourly

**Rules:** No new features. No refactors for style. Only fix broken behavior, incorrect calculations, crashes, and inconsistent UX.

**Execution:** Work tickets in the recommended order below. After each ticket, run the Smoke Test Checklist.

---

## Smoke Test Checklist (run after every ticket)

1. **Auth** — Log in with valid credentials → Dashboard loads. Log out → redirect/login prompt.
2. **Clock** — Clock in → active timer shows. Clock out (with break prompt) → entry closed, manual section visible.
3. **No double open** — While clocked in, refresh page → still one active entry; no duplicate.
4. **Timesheet** — Open Timesheet → current pay period loads; week totals and pay numbers render.
5. **Paycheck** — Open Paycheck Calculator → estimate loads for current period; weekly breakdown shows.
6. **Profile** — Open Profile → settings load; change timezone and save → success.
7. **Export** — Export CSV from Profile or Timesheet → file downloads with expected columns and data.
8. **Admin** (if used) — Admin login → dashboard shows users and current week hours.

---

## Recommended execution order

1. **S-001** — Clock state reliability (Critical)  
2. **S-002** — Prevent two open entries via edit (Critical)  
3. **S-003** — 401 session handling (Critical)  
4. **S-004** — Break total vs. breaks array consistency (High)  
5. **S-005** — Admin dashboard week and data (High)  
6. **S-006** — Export/import consistency and corruption (High)  
7. **S-007** — Clock UI loading and errors (Medium)  
8. **S-008** — Error message consistency (Medium)  
9. **S-009** — Edge cases and polish (Low)  

---

# Critical

## S-001 — Clock state reliability

*Full spec: see `STABILIZATION-CLOCK-STATE.md` in repo root.*

**Symptom:** Double-tap or refresh on Clock In/Out can create duplicate entries or confusing errors; no server guarantee of “at most one open entry.”

**Likely root cause:** No DB constraint; clock-in returns 400 when already open instead of idempotent 200; clock-out returns 400 when already closed; no loading/disabled state on buttons.

**Exact files to touch:**
- `backend/prisma/schema.prisma` (comment only) + new migration SQL
- `backend/prisma/migrations/YYYYMMDD_add_one_active_entry_per_user/migration.sql`
- `backend/src/routes/timeEntries.ts` (clock-in, clock-out handlers)
- `frontend/src/pages/ClockInOut.tsx` (loading/disabled for Clock In/Out)

**Acceptance criteria:**
- At most one row per user with `clockOut IS NULL` (enforced by partial unique index).
- Repeated clock-in (already open) returns 200 + existing entry; no duplicate.
- Repeated clock-out (no open entry) returns 200 + last closed entry; no error.
- Clock In and Clock Out buttons disabled (and show loading) while request in flight.
- Failed requests show a clear user-facing error message.

**Manual test steps:**
1. Clock in, then tap Clock In again quickly → only one entry; no duplicate.
2. Refresh after clock-in, tap Clock In again → 200, same entry; UI stays clocked in.
3. Clock out, then trigger clock-out again (e.g. second tab) → 200, last closed entry.
4. Throttle network; clock in; verify button disabled until response.
5. Disconnect network; clock in → clear error message.

**Automated test to add:** Backend: POST clock-in twice (same user) → second returns 200 and same entry id. POST clock-out twice → second returns 200 and closed entry. Optional: integration test for partial unique index (second open entry insert fails).

---

## S-002 — Prevent two open entries via edit

**Symptom:** User can have two “open” entries: one from clock-in and one from editing an old entry and clearing clock-out, leading to wrong timesheet/pay and confusing state.

**Likely root cause:** PUT `/time-entries/:id` allows `clockOut: null` without checking for an existing open entry; no DB constraint (until S-001 is done).

**Exact files to touch:**
- `backend/src/routes/timeEntries.ts` (PUT `/:id`): before update, if `updateData.clockOut === null`, check for another open entry for this user (id !== req.params.id); if exists return 409 with clear message. After S-001 migration, unique index will also block at DB level; catch and return 409.

**Acceptance criteria:**
- Updating an entry to “open” (clockOut = null) fails with 409 if user already has a different open entry.
- Error message is clear (e.g. “You already have an open time entry. Close it or use that entry.”).
- After S-001, duplicate open insert/update is blocked by DB and returns 409.

**Manual test steps:**
1. Clock in (entry A). Create a manual past entry B (closed). Edit B and set clock out to empty/open → 409.
2. Clock out from A. Edit B to open → success. Edit A to open → 409.
3. With S-001 in place, attempt to create second open entry by any path → 409 or DB error handled as 409.

**Automated test to add:** PUT entry with clockOut: null when user has another open entry → 409.

---

## S-003 — 401 session handling

**Symptom:** After token expiry or invalid token, getProfile fails with 401; token is removed but user may see blank/broken UI or stay on a protected page with no redirect to login.

**Likely root cause:** `useAuth` getProfile catch only removes token; no redirect or global 401 handling to send user to login and show a consistent “session expired” message.

**Exact files to touch:**
- `frontend/src/hooks/useAuth.tsx`: on getProfile 401, remove token and set user to null (already done); consider setting a “sessionExpired” or letting router handle).
- `frontend/src/services/api.ts`: response interceptor on 401: for non-login/register requests, optionally set a flag or broadcast event that AuthProvider can use to redirect.
- `frontend/src/App.tsx` or router: when user is null and route is protected, redirect to login; optionally show a single toast “Session expired” when the reason was 401.

**Acceptance criteria:**
- On 401 from getProfile (e.g. token expired), user is logged out and redirected to login.
- User sees a single, clear message (e.g. “Session expired. Please log in again.”) when 401 caused logout.
- No blank or half-rendered protected pages after 401.

**Manual test steps:**
1. Log in, then in DevTools clear token or corrupt it; refresh → redirect to login and message.
2. Log in, wait for token to expire (or mock 401 on next request); trigger any API call → logout and redirect with message.
3. On login page, wrong password → 401 shows “Invalid email or password”, not “Session expired”.

**Automated test to add:** Optional: mock 401 on getProfile, assert redirect to login and message (e2e or hook test).

---

# High

## S-004 — Break total vs. breaks array consistency

**Symptom:** Paycheck (and other flows) log “stored totalBreakMinutes doesn’t match calculated”; pay or hours may differ between screens that use stored vs. calculated break minutes.

**Likely root cause:** `TimeEntry.totalBreakMinutes` can be set by clock-out and by PUT entry; break add/update/delete recalc from breaks. If someone edits totalBreakMinutes without updating breaks (or old data), stored and sum(breaks) diverge. Paycheck uses calculated for pay but some paths use stored.

**Exact files to touch:**
- `backend/src/routes/timeEntries.ts`: wherever we read totalBreakMinutes for pay/hours (e.g. list, metrics, paycheck, timesheet), prefer: if entry has breaks, use sum from breaks; else use totalBreakMinutes. Optionally add a small “reconcile” on read or a nightly job (out of scope: just use calculated when available).
- `backend/src/routes/paycheck.ts`: already uses calculated from breaks for the main calculation; ensure weekly breakdown and any other display use the same source.
- `backend/src/routes/metrics.ts`: use calculated break minutes from breaks when present.
- `backend/src/routes/timesheet.ts`: use calculated from breaks when present for hours/pay.
- `backend/src/routes/export` (CSV): already uses breaks.reduce; keep. Ensure import and any other writer keep totalBreakMinutes in sync (add/update/delete break already do).

**Acceptance criteria:**
- All pay and “worked hours” calculations use a single rule: sum(breaks) when entry has breaks, else totalBreakMinutes.
- No “stored vs. calculated” mismatch in logs for normal usage (add/edit/delete break and clock-out already sync).
- Export CSV and UI show the same worked hours for an entry.

**Manual test steps:**
1. Add entry with breaks; add/remove breaks → pay and hours update correctly everywhere (Timesheet, Paycheck, Dashboard).
2. Manually set totalBreakMinutes in DB to wrong value (or via an old bug path) → app displays hours/pay based on sum(breaks) not stored.
3. Entry with no breaks → use totalBreakMinutes everywhere.

**Automated test to add:** Unit test: entry with breaks array; assert pay calculation uses sum(breaks). Entry with no breaks; assert uses totalBreakMinutes.

---

## S-005 — Admin dashboard week and data

**Symptom:** Admin “current week” hours and “hours left” are wrong for users in other timezones; week is server-local. Also fetches all entries with clockIn <= weekEnd (no lower bound), which is inefficient and could include very old data.

**Likely root cause:** `getCurrentWorkWeek()` in `backend/src/routes/admin.ts` uses server date (getDay(), etc.). Entries filtered by clockIn <= weekEnd only; then in-memory filter effectiveOut >= weekStart. No user timezone; week boundaries are server-local.

**Exact files to touch:**
- `backend/src/routes/admin.ts`: (1) Add clockIn >= weekStart to the Prisma query so “current week” is bounded. (2) Option A: Fetch user timezones and compute each user’s week in their TZ, then for each user query entries in that UTC range (more accurate). Option B (simpler): Document that admin week is server TZ and add a note in UI “Week is server timezone.” Prefer Option A if we have user timezone; else Option B + fix query to add weekStart so data is at least correct for server TZ and bounded.

**Acceptance criteria:**
- Admin dashboard “current week” query is bounded (clockIn >= weekStart and clockIn <= weekEnd, or equivalent).
- Either: (A) Each user’s week hours use their profile timezone for week boundaries, or (B) UI states that week is in server timezone and numbers are correct for that definition.
- No unbounded query returning excessive rows.

**Manual test steps:**
1. Create entries in “this week” (server TZ); admin dashboard shows them and correct hours.
2. Create entries in previous week; admin does not count them in “current week.”
3. If Option A: user in different TZ has entries in their “Sunday–Saturday”; admin shows that week’s hours for them.

**Automated test to add:** Admin dashboard: mock entries with clockIn in/out of server week; assert only in-week entries counted.

---

## S-006 — Export/import consistency and corruption

**Symptom:** Exported CSV might show different break/hours than UI if totalBreakMinutes was out of sync; import of malformed CSV could create bad entries or crash; re-importing export might change data (encoding, date format, or rounding).

**Likely root cause:** Export uses breaks.reduce (good) but date/time format or encoding might differ from what import expects; import may not validate all fields (e.g. clockOut < clockIn, or invalid dates); duplicate detection might be date-format sensitive.

**Exact files to touch:**
- `backend/src/routes/timeEntries.ts`: Export: ensure open entries (no clockOut) are clearly represented (e.g. “Open” or empty); same format as import expects. Use consistent date/time format (e.g. ISO or Hours Keeper style).
- `backend/src/routes/import.ts`: Validate each row: clockIn < clockOut when both present; dates parseable; reject or skip bad rows with clear error/skip message. Ensure round-trip: export then import (same user) does not create duplicates when duplicate detection is used, and does not corrupt numbers (break minutes, times).
- `frontend/src/pages/Import.tsx`: Show clear errors when import returns validation errors or skip list.

**Acceptance criteria:**
- Export produces CSV that imports without error and, when re-imported with duplicate detection, does not create duplicate entries or corrupt data.
- Import rejects or skips rows with clockOut <= clockIn or invalid dates; reports which rows failed/skipped.
- Open entries in export are identifiable; import either skips them or handles them (per product rule).

**Manual test steps:**
1. Export a date range with mixed open/closed entries → open clearly marked.
2. Import the same CSV (new user or date range) → no crash; entries match.
3. Import CSV with one row clockOut before clockIn → row skipped or error; no bad entry.
4. Import malformed CSV (wrong columns, bad dates) → clear error or skip list.

**Automated test to add:** Export then parse CSV and assert structure. Import test: valid CSV → entries created; invalid row → skipped or error.

---

# Medium

## S-007 — Clock UI loading and errors

**Symptom:** User can tap Clock In or Clock Out multiple times during request; no loading indicator on the main buttons; error message may be generic or missing.

**Likely root cause:** Clock In/Out buttons in `ClockInOut.tsx` have no disabled state or loading state tied to the in-flight request; error displayed from catch but might not surface server message consistently.

**Exact files to touch:**
- `frontend/src/pages/ClockInOut.tsx`: Add state e.g. `isClockingIn`, `isClockingOut`. During handleClockIn: set true, await API, then loadStatus, set false. Disable Clock In button when isClockingIn; show “Clocking in…” or spinner. Same for Clock Out (and during break dialog submit). Ensure server error (e.g. response.data.error) is shown in alert.

**Acceptance criteria:**
- Clock In button disabled and shows loading while clock-in request in flight.
- Clock Out (and break dialog confirm) disabled and shows loading while clock-out request in flight.
- On failure, user sees server error message or a fallback “Couldn’t clock in/out. Try again.”

**Manual test steps:**
1. Slow 3G; tap Clock In → button disabled until response.
2. Force 500 or network error → clear message in alert/dialog.
3. Clock out with break → loading on confirm, then success.

**Automated test to add:** Optional: unit test that button is disabled when isClockingIn true.

---

## S-008 — Error message consistency

**Symptom:** Some API errors show “Internal server error,” others show server message; network errors might show technical message; 401 shows “Invalid email or password” even when it was session expiry.

**Likely root cause:** Inconsistent use of error.response?.data?.error across pages; interceptor sets userMessage only for 401/network/CORS; other 4xx/5xx not mapped.

**Exact files to touch:**
- `frontend/src/services/api.ts`: In response interceptor, for 4xx/5xx set error.userMessage from response.data?.error or response.data?.message when present, else generic “Something went wrong” or “Server error.”
- `frontend/src/pages/*.tsx` (Login, Register, ClockInOut, Profile, Import, etc.): Where we catch and show error, prefer error.userMessage || error.response?.data?.error || generic string; avoid raw “Internal server error” or stack.

**Acceptance criteria:**
- User-facing errors are short, actionable, and never show stack traces or “Internal server error” without a fallback phrase.
- 401 on login/register → “Invalid email or password.” 401 on other routes → “Session expired” (after S-003) or logout.
- Network error → “Check your connection” type message.

**Manual test steps:**
1. Trigger 400 (e.g. invalid payload) → message from server or “Something went wrong.”
2. Trigger 500 → “Something went wrong” or server message if provided.
3. Disconnect network → “Check your connection” style message.

**Automated test to add:** Optional: assert interceptor sets userMessage for 401, 500, network.

---

# Low

## S-009 — Edge cases and polish

**Symptom:** Minor bugs: e.g. pay period end day 31 in short months; very old dates in filters; empty states or zero values displayed oddly; rounding showing more decimals than needed.

**Likely root cause:** Pay period logic for end day 31 (e.g. Feb 31 doesn’t exist); date pickers or filters without sane bounds; toFixed or formatting inconsistent; empty arrays not handled.

**Exact files to touch:**
- `backend/src/utils/timezone.ts` and `payPeriod.ts`: Monthly pay period when payPeriodEndDay is 31 and month has fewer days (e.g. Feb): use last day of month or clamp (document and implement one rule).
- `frontend` and `backend`: Any place that formats currency or hours: consistent decimals (e.g. 2 for money, 2 for hours).
- Empty states: Timesheet/Paycheck when no entries → clear “No entries” message, no NaN or “0.00” in confusing places.
- Date range validation: startDate <= endDate; reject or swap.

**Acceptance criteria:**
- payPeriodEndDay 31 in Feb (and other short months) does not produce invalid dates; behavior documented.
- No NaN or undefined in displayed totals or rates.
- Empty pay period shows clear empty state.
- Date range APIs reject or normalize start > end.

**Manual test steps:**
1. Set pay period end day to 31; set timezone to one that had Feb; load timesheet for Feb → no crash, correct period.
2. Load Paycheck for period with no entries → “$0.00” and no NaN.
3. Request timesheet with startDate > endDate → 400 or normalized.

**Automated test to add:** Pay period for Feb with end day 31: assert valid date range. Format helpers: assert no NaN for zero/empty input.

---

# Summary table

| ID     | Severity  | Title                              | Order |
|--------|-----------|------------------------------------|-------|
| S-001  | Critical  | Clock state reliability            | 1     |
| S-002  | Critical  | Prevent two open entries via edit  | 2     |
| S-003  | Critical  | 401 session handling               | 3     |
| S-004  | High      | Break total vs. breaks consistency | 4     |
| S-005  | High      | Admin dashboard week and data      | 5     |
| S-006  | High      | Export/import consistency           | 6     |
| S-007  | Medium    | Clock UI loading and errors        | 7     |
| S-008  | Medium    | Error message consistency          | 8     |
| S-009  | Low       | Edge cases and polish              | 9     |

---

*End of Stability Backlog. Run the Smoke Test Checklist after each ticket.*
