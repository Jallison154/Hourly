#!/usr/bin/env bash
# Snapshot the Hourly SQLite database safely.
# Usage: ./scripts/backup-sqlite.sh [db-path] [backup-dir] [retain-count]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="${1:-$ROOT/backend/prisma/dev.db}"
BACKUP_DIR="${2:-$ROOT/backups}"
RETAIN="${3:-14}"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "Error: database not found at $DB_PATH"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
DEST="$BACKUP_DIR/hourly-${STAMP}.db"

# Prefer sqlite3 online backup if available; otherwise copy
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$DEST'"
else
  cp "$DB_PATH" "$DEST"
fi

# Verify the copy opens
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DEST" "PRAGMA integrity_check;" | grep -q "^ok$" || {
    echo "Error: backup failed integrity check"
    rm -f "$DEST"
    exit 1
  }
fi

echo "✓ Backup written: $DEST"

# Retain only the newest N backups
ls -1t "$BACKUP_DIR"/hourly-*.db 2>/dev/null | tail -n +"$((RETAIN + 1))" | while read -r old; do
  rm -f "$old"
  echo "  removed old backup: $old"
done
