# Hourly Modernization Report

Date: 2026-07-16

## 1. Issues discovered

- JWT fallback to `"secret"` when `JWT_SECRET` unset
- Admin auth reused raw `ADMIN_PASSWORD` as bearer token (stored in `sessionStorage`)
- Open CORS (all origins) with credentials
- No Helmet or rate limiting
- Login enumeration (“no account” vs “wrong password”) + verbose auth logs
- Password minimum length 6
- Docs claimed PostgreSQL while runtime/install used SQLite
- Money/OT math used floats with duplicated weekly OT logic; OT threshold hardcoded at 40; workweek hardcoded Sunday
- Tax tables unlabeled; MT sometimes described as flat
- PaycheckCalculator orphaned from routes
- No CI / Dependabot; sparse tests
- PWA icons/theme inconsistent; API caching risk
- `update.sh` rebuilt/restarted without DB backup, migrate deploy, or health check

## 2. Changes completed

### Phase A — Security
- Zod env validation (`backend/src/config/env.ts`); fail startup if invalid
- JWT fail-closed; admin login returns 60-minute signed admin JWT
- Timing-safe / bcrypt admin password verify
- Helmet, CORS allowlist (+ no-Origin for Capacitor; LAN in dev), rate limits on auth/admin login
- Generic login errors; password min 10; stripped sensitive logs; reset-password no longer prints password
- Frontend stores admin JWT only

### Phase B — Data / deploy
- SQLite docs alignment (README, SETUP, BACKUP_RESTORE)
- `scripts/backup-sqlite.sh` + hardened `update.sh` (backup → migrate deploy → build → restart → health)
- Money cents helpers; pay calculator uses threshold + workweek start
- Shared `workedTime` overlap/break clipping helpers
- Tax year modules (`federal-2024`, `montana-2024`) + UI estimate disclaimer
- Prisma migration: `overtimeThresholdHours`, `workweekStartDay`, `AdminAuditLog`
- Vitest unit tests for money, worked time, tax

### Phase C — Product
- Clock warnings (future time, long shifts); break-within-shift validation
- Admin filters + long-shift flags + `/api/admin/audit`
- Mobile nav: Clock / Timesheet / Schedule / Paycheck / More; Paycheck route wired
- Okami design tokens (orange accent), Button/nav polish, OfflineBanner, UpdateToast
- PWA: NetworkOnly for `/api`, update prompt, theme alignment
- Import 5MB CSV limit
- GitHub Actions CI + Dependabot
- Frontend Vitest + ESLint config

## 3. Database migrations added

- `backend/prisma/migrations/20260717000000_workweek_ot_audit/migration.sql`
  - Adds `User.overtimeThresholdHours` (default 40)
  - Adds `User.workweekStartDay` (default 0 = Sunday)
  - Creates `AdminAuditLog`

Defaults preserve previous Sun–Sat / 40h behavior.

## 4. Environment variables added or changed

| Variable | Notes |
|----------|--------|
| `JWT_SECRET` | Required, ≥32 chars; no fallback |
| `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH` | One required |
| `ALLOWED_ORIGINS` | Required in production |
| `HOST` | Default `0.0.0.0` |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `PORT` | Default 5000 |
| `DATABASE_URL` | SQLite file URL |

See `backend/.env.example`.

## 5. Tests added

- Backend Vitest: money, pay/OT, worked-time clipping, tax year/MT progressive
- Frontend Vitest: OfflineBanner
- Scripts: `npm test`, `test:watch`, `test:coverage`, `typecheck` (both packages)

## 6. Remaining risks

- Prisma money columns remain `Float` (calc layer uses cents; schema migration deferred)
- Tax tables are **2024-era estimates**, not verified 2026 IRS/MT tables
- Admin can view audit log API but full admin edit-of-entries UI is not built yet (audit helper + model ready)
- Import preview / full CSV enrichment partially deferred; size validation + existing parsers remain
- Frontend lint still has hook dependency warnings (non-blocking)
- Dependency audit still reports known npm advisories (staged upgrades recommended)

## 7. Manual deployment steps

1. On server: pull or run `./update.sh`
2. Ensure `backend/.env` has new required vars (`JWT_SECRET` length, `ALLOWED_ORIGINS`, admin password)
3. Confirm backup written under `./backups/`
4. Confirm `prisma migrate deploy` applied `20260717000000_workweek_ot_audit`
5. Health: `curl -s http://127.0.0.1:5000/api/health`
6. Smoke: login, admin login (JWT), clock in/out, paycheck estimate (tax year note), profile OT settings

## 8. User-facing impact

- Existing passwords shorter than 10 chars still work for login; new passwords / changes require ≥10
- Admin users must re-login (password is no longer the token)
- CORS may block unexpected browser origins until listed in `ALLOWED_ORIGINS`
- Pay/OT defaults unchanged unless user edits threshold / workweek start
- Visual accent shifts toward Okami orange; paycheck shows estimate/tax-year disclaimer
