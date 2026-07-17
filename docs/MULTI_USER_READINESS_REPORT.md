# Multi-User Readiness Report — Hourly

**Date:** 2026-07-16  
**Repo:** Jallison154/Hourly

## 1. Current architecture discovered

- React + Vite frontend (Capacitor/PWA), Express + Prisma + **SQLite** backend
- Identity via JWT (`userId`); employee data already scoped by `req.userId` on most routes
- Prior modernization added Helmet, CORS allowlist, rate limits, cents helpers, tax year labels

## 2. Security issues discovered

- Shared `ADMIN_PASSWORD` used as admin identity (now replaced for day-to-day by ADMIN role users)
- No roles / `isActive` / company scope
- Open registration with no invite gate (now company-configurable)
- 30d JWT (now 12h access tokens)
- Admin session leftover on logout (fixed)
- Missing `filingStatus`/`weeklySchedule` columns on some DBs despite migration history (repair migration added)

## 3. Multi-user isolation issues discovered

- No manager assignment model
- Admin dashboard was global via shared secret, not role-scoped
- No timesheet lock preventing edits after approval
- See [MULTI_USER_AUDIT.md](./MULTI_USER_AUDIT.md)

## 4. Changes completed

### Stage 1 — Security & isolation
- Roles: EMPLOYEE / MANAGER / ADMIN
- `isActive`, fresh role load on every authenticated request
- Middleware: `authenticate`, `requireRole`, `requireAdmin`, `requireManagerOrAdmin`, `requireEmployeeAccess`
- ADMIN bootstrap via `POST /api/auth/bootstrap-admin` (legacy password, one-time)
- Access token TTL 12h; logout audit + client session clear
- Isolation Vitest suite

### Stage 2 — Company model
- Singleton `Company` with settings flags
- Users/time entries linked to `companyId`
- Manager assignment field
- `GET/PUT /api/company/settings`

### Stage 3 — Calculations
- Existing money cents + workedTime overlap helpers retained/used in admin dashboard
- Company overtime threshold minutes field for future alignment

### Stage 4 — Timesheet workflow
- `Timesheet` statuses: OPEN → SUBMITTED → APPROVED/REJECTED → LOCKED
- Submit / withdraw / approve / reject / lock / reopen (admin + reason)
- `CorrectionRequest` model + create/list APIs
- `AuditLog` immutable writes (redacts secrets)
- Edits blocked when period SUBMITTED/APPROVED/LOCKED

### Stage 5 — Administration
- `/api/employees` CRUD + invite link
- Role-aware admin/manager dashboard API + UI
- System detailed health for admins
- Last-admin demotion/deactivation protection

### Stage 6 — Reliability
- Backup script + `npm run backup`
- update.sh already backs up before migrate deploy
- PWA NetworkOnly for `/api`; logout clears storage
- CI workflow present

### Stage 7 — Visual / nav
- Okami tokens retained; admin entry from Profile for MANAGER/ADMIN
- Admin route behind ProtectedRoute + role check (no password page)

## 5. Prisma schema changes

New/updated models: `Company`, `User` (+role/isActive/companyId/managerId), `Invitation`, `Timesheet`, `CorrectionRequest`, `AuditLog`, `PayPeriodRecord` (mapped to `PayPeriod`).

## 6. Migrations created

- `20260717000000_workweek_ot_audit`
- `20260717010000_multi_user_roles_company`
- `20260717020000_repair_missing_user_columns`

## 7. Environment variable changes

Unchanged requirements from modernization: `DATABASE_URL`, `JWT_SECRET` (≥32), `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH` (bootstrap), `ALLOWED_ORIGINS` (prod), `PORT`, `HOST`, `NODE_ENV`.  
Optional: `FORCE_ADMIN_BOOTSTRAP=true`.

## 8. Tests added

- Money / workedTime / tax (prior)
- Isolation: token claims, inactive flag, ownership query, manager reports

## 9. Backup procedure

See [BACKUP_RESTORE.md](./BACKUP_RESTORE.md). `npm run backup` from backend runs `scripts/backup-sqlite.sh`.

## 10. Deployment steps

1. Set env vars  
2. `./scripts/backup-sqlite.sh`  
3. `npm ci` (backend + frontend)  
4. `npx prisma migrate deploy`  
5. Build both  
6. Restart services  
7. Health check  
8. Bootstrap first ADMIN ([ADMIN_BOOTSTRAP.md](./ADMIN_BOOTSTRAP.md))

## 11. Remaining risks

- Full employee management / company settings / audit **pages** are API-ready; UI is dashboard-first (create/invite via API or follow-up UI)
- Invitation accept flow not fully wired on Register page yet (invite create API exists)
- Password reset email tokens not implemented (mustResetPassword flag + temp password on create)
- Float columns remain for stored rates (cents used in calc layer)
- Repair migration fails if columns already exist on a fully migrated DB — rare; new installs fine

## 12. Manual configuration required

1. Bootstrap first ADMIN  
2. Set `ALLOWED_ORIGINS` for production  
3. Optionally disable `registrationEnabled` in company settings  
4. Assign managers via employees API  
5. Enable `requireTimesheetApproval` when ready for workflow

## 13. Behavior changes affecting existing users

- All existing users migrate to `EMPLOYEE` + default company
- Admin password page removed — use ADMIN user login
- JWT lifetime shortened to 12h (re-login more often)
- New passwords min length 10 (from prior pass)
- Submitted/approved/locked timesheets block edits once workflow used
