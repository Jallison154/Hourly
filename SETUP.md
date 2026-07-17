# Database Setup Guide

Hourly uses **SQLite** via Prisma. No separate database server is required.

## Quick Setup

1. Create `backend/.env` from the example:

```bash
cd backend
cp .env.example .env
```

2. Edit `.env` and set at least:

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="generate-with-openssl-rand-hex-32"
ADMIN_PASSWORD="a-strong-admin-password"
PORT=5000
HOST=0.0.0.0
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

In production, `ALLOWED_ORIGINS` is required. Prefer `ADMIN_PASSWORD_HASH` (bcrypt) over a plaintext `ADMIN_PASSWORD`.

3. Run migrations:

```bash
npx prisma generate
# Development:
npx prisma migrate dev
# Production / server updates:
npx prisma migrate deploy
```

4. Start the API:

```bash
npm run dev
```

## Backups

See [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md). Production updates should use `./update.sh`, which backs up the DB before `prisma migrate deploy`.

## Do not

- Do not run `prisma migrate reset` against a live database with user data.
- Do not commit real secrets in `.env`.
