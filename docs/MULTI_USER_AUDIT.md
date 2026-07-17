# Multi-User Authorization Audit — Hourly

**Date:** 2026-07-16  
**Scope:** Backend routes + frontend auth/caching  
**Verdict:** Employee self-scoping is largely solid (JWT `userId`). Gaps are roles, company scope, admin-as-user, account lifecycle, timesheet workflow, and shared-device logout.

## Summary

| Area | Status |
|------|--------|
| Employee routes filter by `req.userId` | PASS |
| Client-supplied `userId` trusted | PASS (not accepted) |
| IDOR on entry/break IDs | PASS |
| CSV export/import cross-user leak | PASS |
| Role system (EMPLOYEE/MANAGER/ADMIN) | FAIL (missing) |
| Company / manager assignment | FAIL (missing) |
| Admin as normal ADMIN user | FAIL (shared env password + JWT) |
| `isActive` / deactivated token reject | FAIL |
| Timesheet submit/approve/lock | FAIL |
| Complete audit on payroll mutations | PARTIAL |
| Frontend ProtectedRoute flash | PASS |
| Admin route role-gated | FAIL (password page only) |
| Logout clears admin + private state | FAIL |
| PWA caches `/api` | PASS (NetworkOnly) |

## Backend route groups

### Auth (`/api/auth`) — PASS isolation / RISK open register
- `POST /register`, `POST /login`: public, rate-limited; no cross-user leak.
- RISK: unrestricted registration; no invite flow.

### User (`/api/user`) — PASS
- Profile/schedule/password all scoped to `req.userId`.
- Password never returned.

### Time entries — PASS
- Clock, CRUD, breaks, export, bulk-delete: ownership via `req.userId` or `timeEntry.userId`.
- No body/query `userId`.

### Timesheet / paycheck / metrics / import — PASS
- Always scoped to authenticated user.

### Admin (`/api/admin`) — PASS gate / RISK model
- `requireAdmin` checks admin JWT role.
- Dashboard returns **all** users (intentional for shared admin secret).
- RISK: not a per-user ADMIN role; shared `ADMIN_PASSWORD`.

### Public — PASS
- `/api/health`, `/api/test`: no private data.

## Frontend findings

| Issue | Severity |
|-------|----------|
| `/admin` not behind user role | High |
| Admin JWT survives user logout | High |
| Admin 401 clears user JWT | Medium |
| User JWT in localStorage | Medium (shared device) |
| No `userId` in client API payloads | Pass |
| ProtectedRoute loading gate | Pass |
| PWA NetworkOnly for `/api` | Pass |

## Required follow-ups (this plan)

1. Add `role`, `isActive`, `companyId`, `managerId`.
2. Replace password-admin with ADMIN user accounts.
3. Company singleton + settings.
4. Timesheet workflow + audit.
5. Employee/manager/admin UI with role-aware nav.
6. Isolation tests proving User A ≠ User B.
