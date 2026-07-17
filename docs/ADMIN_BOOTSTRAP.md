# Promoting the first administrator

Hourly administrators are normal user accounts with `role = ADMIN`.

## Steps

1. Register (or use an existing) employee account.
2. Ensure `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH`) is set in `backend/.env`.
3. Call the one-time bootstrap endpoint:

```bash
curl -s -X POST http://localhost:5000/api/auth/bootstrap-admin \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","adminPassword":"YOUR_ADMIN_PASSWORD"}'
```

4. Log in with that user’s email/password. Open **More → Admin dashboard**.
5. After at least one ADMIN exists, bootstrap is disabled unless `FORCE_ADMIN_BOOTSTRAP=true`.
6. Prefer rotating away from a long-lived `ADMIN_PASSWORD` once you have ADMIN users.

Managers are assigned via `PATCH /api/employees/:id` with `{ "managerId": "..." }` (ADMIN only).
