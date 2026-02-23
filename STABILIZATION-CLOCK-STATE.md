# Stabilization Ticket: Clock State Reliability

**Goal:** Enforce at most one active time entry per user server-side, make clock-in and clock-out idempotent, and prevent double-tap / refresh / flaky network from corrupting entries.

**Scope:** Stabilization only — no new features.

---

## 1) Database Constraints & Safe Migration (SQLite)

### 1.1 Proposed constraint

- **Rule:** At most one *active* (open) time entry per user. Active = `clockOut IS NULL`.
- **Implementation:** A **partial unique index** so that `(userId)` is unique among rows where `clockOut IS NULL`.

SQL (SQLite 3.8+):

```sql
CREATE UNIQUE INDEX idx_time_entry_one_active_per_user
ON TimeEntry(userId) WHERE clockOut IS NULL;
```

This guarantees only one open entry per user regardless of which code path creates or updates it (clock-in, manual entry, or future edits).

### 1.2 Prisma schema

Prisma does not support partial unique indexes in the schema DSL. Keep the index in a **raw SQL migration** and do **not** add a `@@unique` in `schema.prisma` (that would apply to all rows and is wrong).

Optional: document the index in a comment in `schema.prisma`:

```prisma
model TimeEntry {
  // ...
  // DB: partial unique index (userId) WHERE clockOut IS NULL via migration
  @@index([userId])
  @@index([clockIn])
}
```

### 1.3 Safe migration steps (SQLite)

1. **Pre-migration check (data fix):** Ensure no user has more than one open entry.
   - Query: `SELECT userId, COUNT(*) FROM TimeEntry WHERE clockOut IS NULL GROUP BY userId HAVING COUNT(*) > 1`
   - If any rows: resolve duplicates (e.g. keep the latest by `clockIn` per user, set `clockOut = clockIn` or `clockOut = now()` for the others, or otherwise close duplicates). Apply fixes in a migration step or a one-off script before adding the index.

2. **Create migration file** (e.g. `backend/prisma/migrations/YYYYMMDDHHMMSS_add_one_active_entry_per_user/migration.sql`):
   - Run the duplicate-cleanup SQL if needed (e.g. `UPDATE TimeEntry SET clockOut = clockIn WHERE id IN (...)` for duplicates you chose to close).
   - Then: `CREATE UNIQUE INDEX idx_time_entry_one_active_per_user ON TimeEntry(userId) WHERE clockOut IS NULL;`

3. **Apply:** `npx prisma migrate deploy` (or `prisma migrate dev` in dev). SQLite supports partial indexes, so this is valid.

4. **Rollback (if ever needed):** `DROP INDEX idx_time_entry_one_active_per_user;` in a new migration. No Prisma schema change to revert.

---

## 2) API Changes (Preserve Client Contract)

### 2.1 Current behavior

- **POST /time-entries/clock-in:** If user already has an open entry → `400` with message "You already have an open time entry. Please clock out first." Otherwise creates entry and returns `201` + entry.
- **POST /time-entries/clock-out:** If no open entry → `400` "No open time entry found". Otherwise updates that entry and returns `200` + entry.

### 2.2 Idempotent behavior (proposed)

- **POST /time-entries/clock-in**
  - If user **already has an open entry:** return **200** and the **existing open entry** (same response shape as create). Do not create a second entry; do not return 400.
  - Otherwise: create entry and return **201** + new entry (unchanged).
  - **Client:** No change required. Response body is always a single time entry; client can keep calling `loadStatus()` after as today.

- **POST /time-entries/clock-out**
  - If user **has an open entry:** update it and return **200** + updated entry (unchanged).
  - If user **has no open entry** (e.g. already clocked out or duplicate request): return **200** and the **most recently closed entry** for that user (e.g. `orderBy: { clockOut: 'desc' }`, `take: 1`, where `clockOut != null`). This gives a consistent “last closed” result for repeat calls.
  - **Client:** No change required. Response body remains a single time entry; client still calls `loadStatus()` and gets `isClockedIn: false` after.

### 2.3 Response codes summary

| Endpoint              | Scenario            | Current | Proposed |
|-----------------------|---------------------|---------|----------|
| POST .../clock-in     | No open entry       | 201 + entry | 201 + entry (unchanged) |
| POST .../clock-in     | Already open entry  | 400     | 200 + existing entry    |
| POST .../clock-out    | Has open entry      | 200 + entry | 200 + entry (unchanged) |
| POST .../clock-out    | No open entry       | 400     | 200 + last closed entry |

### 2.4 Other API surface

- **GET /time-entries/status:** No change; keep returning `{ isClockedIn, entry }`.
- **POST /time-entries** (manual entry), **PUT /time-entries/:id:** No change to request/response. The new DB constraint will prevent creating or editing entries so that a second open entry exists (e.g. setting `clockOut` to `null` on an old entry when user already has an open one). Return a **409 Conflict** (or 400) with a clear message if an update would violate “at most one open entry per user.”

### 2.5 Implementation notes (backend)

- In **clock-in:** use a single transaction: `findFirst` open entry; if found, return 200 + that entry; else create and return 201 + new entry.
- In **clock-out:** `findFirst` open entry; if found, update and return 200 + updated entry; else find last closed entry and return 200 + that entry.
- After adding the partial unique index, any attempt to create a second open entry (e.g. race or bug) will throw; catch and return 409/500 with a clear message.

---

## 3) Frontend UX Changes

### 3.1 Loading and disabled states

- **Clock In button:** While a clock-in request is in flight, disable the button and show a loading state (e.g. “Clocking in…” or spinner). Prevent double submission.
- **Clock Out button:** While a clock-out request is in flight (including after “Break” dialog confirm), disable the Clock Out action and show loading (e.g. “Clocking out…” or spinner). Disable or hide the break dialog primary action until the request completes.

### 3.2 Error messages

- Surface **server error message** in the UI for clock-in and clock-out (e.g. `response?.data?.error`). Already partially present; ensure all paths (network error, 4xx, 5xx) show a single, user-friendly string (e.g. “Couldn’t clock in. Please try again.” or the server message if it’s safe to show).
- Avoid raw stack traces or “Internal server error” only; prefer a short, actionable message.

### 3.3 No new features

- No new endpoints, no new screens. Only loading/disabled states and clearer, stable error handling.

---

## 4) Acceptance Criteria & Manual Test Cases

### 4.1 Acceptance criteria

- **AC1.** At most one active (open) time entry per user is stored; duplicate open entries cannot be created by any supported API path.
- **AC2.** Multiple identical **clock-in** requests (e.g. double-tap, refresh and resubmit) do not create duplicate entries; the client receives one entry (existing or newly created) and UI shows a single “clocked in” state.
- **AC3.** Multiple identical **clock-out** requests do not create or modify multiple entries; the client receives a single closed entry and UI shows “not clocked in.”
- **AC4.** Clock-in and Clock Out buttons are disabled (and show loading) while their request is in flight; user cannot double-submit from the UI.
- **AC5.** Failed requests (network, 4xx, 5xx) show a clear, user-facing error message; no duplicate entries are created on retry when the first request actually succeeded.

### 4.2 Manual test cases

1. **Double-tap Clock In**
   - Clock in once; before the response returns, tap Clock In again (or trigger two quick requests).
   - **Expected:** Only one time entry is created; UI shows one active entry; no duplicate open entries.

2. **Refresh and Clock In again**
   - Clock in; wait for success; refresh the page; tap Clock In again.
   - **Expected:** Idempotent: server returns existing open entry; UI stays “clocked in” with same entry; no second entry.

3. **Double-tap Clock Out**
   - Clock in; then trigger Clock Out twice in quick succession (e.g. double-tap or two requests).
   - **Expected:** Only one entry is closed; UI shows “not clocked in”; second request returns 200 with same closed entry; no duplicate or corrupted entry.

4. **Clock Out when already clocked out**
   - Clock in, then clock out. Call clock-out again (e.g. via devtools or a second tab).
   - **Expected:** 200 with last closed entry; no error; UI remains “not clocked in.”

5. **Slow network / flaky network**
   - Throttle network (e.g. DevTools “Slow 3G”). Clock in; wait; if UI shows loading, wait for success then refresh.
   - **Expected:** After success, only one entry exists; refresh shows correct state; no duplicate entries from retries or refresh.

6. **Buttons disabled during request**
   - Clock in (or out) and immediately try to tap the same action again.
   - **Expected:** Button is disabled or shows “Clocking in…” / “Clocking out…” and does not send a second request until the first completes.

7. **Error message on failure**
   - Force a failure (e.g. disconnect network, or temporarily return 500 from server). Trigger clock-in or clock-out.
   - **Expected:** User sees a clear message (e.g. “Couldn’t clock in. Please check your connection and try again.” or server message); no duplicate entry created if a retry later succeeds (idempotent).

8. **DB constraint: manual entry / edit**
   - With one open entry, attempt to create or edit another entry so it becomes open (e.g. set `clockOut` to null on another entry via API if allowed).
   - **Expected:** Request fails (409/400) with clear message; DB partial unique index prevents two open entries.

---

## Summary

| Area        | Change |
|------------|--------|
| **DB**     | Add partial unique index `(userId) WHERE clockOut IS NULL` via raw SQL migration; clean duplicate open entries before applying. |
| **API**    | Clock-in: return 200 + existing entry when already open; Clock-out: return 200 + last closed entry when no open entry; block updates that would create two open entries (409/400). |
| **Frontend** | Disable Clock In / Clock Out and show loading during request; show clear, user-facing error messages. |
| **Tests**  | Use acceptance criteria and manual cases above to verify idempotency, single active entry, and UX. |
