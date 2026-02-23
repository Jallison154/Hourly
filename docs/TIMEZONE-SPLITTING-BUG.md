# Timezone Splitting Bug: Root Cause & Fix

## Root cause summary

Entries are stored as UTC instants and displayed at correct local time, but **grouping and pay-period boundaries** are computed using **server local time** (or UTC) instead of **user local time**. That causes:

1. **Day buckets**: `entry.clockIn.toISOString().split('T')[0]` uses **UTC date**. Example: 23:30 in America/Denver is 06:30 next day UTC → entry is grouped into the wrong day.
2. **Week boundaries (Sun–Sat)**: `date.getDay()`, `new Date(y,m,d)` in Node use **server** timezone. So “Sunday 00:00” is server’s Sunday, not the user’s. Entries near the user’s Sunday midnight can land in the wrong week (and wrong overtime bucket).
3. **Monthly pay period (e.g. 11th–10th)**: Same: `new Date(year, month, payPeriodEndDay+1, 0,0,0,0)` is server-local. User in Tokyo with end day 10 could see period boundaries shifted by a day vs. their calendar.
4. **DST**: During fall-back/spring-forward, “midnight” and “end of day” in server/local can double or skip hours; week/pay-period boundaries must be in a single timezone (user’s) to stay consistent.

**Single source of truth:**

- **Store**: Keep timestamps as UTC instants (already the case).
- **Boundaries**: Compute period boundaries (day, week, pay period) in **user timezone** (IANA, e.g. `America/Denver`).
- **Queries**: Convert those local boundaries to **UTC instants** for Prisma/DB.
- **Grouping**: Use **local day key** `YYYY-MM-DD` in user timezone (e.g. from UTC instant via luxon in that zone).

---

## Files to modify

| Area | File | Change |
|------|------|--------|
| Schema | `backend/prisma/schema.prisma` | Add `timezone String?` to User |
| Migration | New migration | Add column (default null → treat as UTC for backward compat) |
| Backend util | `backend/src/utils/timezone.ts` (new) | Luxon helpers: pay period bounds, week bounds, local day key |
| Backend | `backend/src/utils/payPeriod.ts` | Add timezone-aware APIs that return UTC Date bounds |
| Backend | `backend/src/routes/user.ts` | Include `timezone` in profile get/put and schema |
| Backend | `backend/src/routes/metrics.ts` | User TZ for pay period + dailyHours by local day key |
| Backend | `backend/src/routes/timeEntries.ts` | Pass user timezone when resolving pay period default range |
| Backend | `backend/src/routes/paycheck.ts` | Pay period and weeks in user TZ |
| Backend | `backend/src/routes/timesheet.ts` | Pay period and weeks in user TZ |
| Backend | `backend/src/routes/admin.ts` | Week bounds in user TZ per user (or keep server week for “admin view” – doc says user TZ) |
| Backend | `backend/src/utils/payCalculator.ts` | Week key by user TZ (needs TZ passed in) |
| Frontend | `frontend/src/types/index.ts` | Add `timezone?: string \| null` to User |
| Frontend | `frontend/src/pages/Profile.tsx` | Add timezone field, default from `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| Tests | `backend/src/utils/__tests__/timezone.test.ts` (new) | Midnight split, pay boundary, week boundary, DST |

### How to run timezone tests

From the `backend` directory:

```bash
npm run test:timezone
```

Or from repo root:

```bash
npx tsx backend/src/utils/__tests__/timezone.test.ts
```

---

## Implementation details

- **User timezone**: IANA string (e.g. `America/Denver`). Default from browser on first load; stored in profile. Backend uses it for that user’s period math.
- **Backward compatibility**: If `user.timezone` is null/empty, use `'UTC'` so behavior matches “server UTC” and no duplicate entries.
- **Luxon**: Added to backend for `DateTime` in zone, `startOf('day')`, `endOf('day')`, and conversion to UTC for DB queries.
- **Admin dashboard**: `backend/src/routes/admin.ts` still uses server-local “current work week” for the dashboard list. Per-user week hours could be refined later to use each user’s timezone.
