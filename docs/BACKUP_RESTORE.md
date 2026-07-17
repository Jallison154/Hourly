# SQLite Backup and Restore

Hourly uses **SQLite** (`backend/prisma/dev.db` by default). Backups must not be served by the public web server.

## Backup

```bash
chmod +x scripts/backup-sqlite.sh
./scripts/backup-sqlite.sh
```

Optional args: `[db-path] [backup-dir] [retain-count]`

Default retention: 14 backups in `./backups/` (gitignored).

`update.sh` runs a backup automatically before `prisma migrate deploy`.

## Restore

1. Stop services:
   ```bash
   sudo systemctl stop hourly-backend hourly-frontend
   ```
2. Copy the chosen backup over the live database (keep a safety copy of the current file first):
   ```bash
   cp backend/prisma/dev.db backend/prisma/dev.db.before-restore
   cp backups/hourly-YYYYMMDD_HHMMSS.db backend/prisma/dev.db
   ```
3. Start services:
   ```bash
   sudo systemctl start hourly-backend hourly-frontend
   ```
4. Hit health: `curl -s http://127.0.0.1:5000/api/health`

Do **not** run `prisma migrate reset` or delete the live database during normal updates.
