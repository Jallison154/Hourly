#!/bin/bash

# Update from git, backup DB, migrate, rebuild, restart, health-check Hourly services

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Updating Hourly from Git"
echo "=========================================="
echo ""

if [ "$EUID" -eq 0 ]; then
    SUDO_CMD=""
else
    SUDO_CMD="sudo"
fi

if [ ! -d ".git" ]; then
    echo "Error: Not a git repository"
    exit 1
fi

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")

set +e

if ! git diff --quiet 2>/dev/null || ! git diff --staged --quiet 2>/dev/null; then
    echo "→ Stashing local changes..."
    git stash push -m "Auto-stash before update.sh $(date +%Y-%m-%d_%H%M%S)" 2>/dev/null
    STASHED=true
else
    STASHED=false
fi

echo "→ Fetching latest changes from origin..."
git fetch origin --prune 2>/dev/null

if [ $? -eq 0 ]; then
    LOCAL=$(git rev-parse HEAD 2>/dev/null)
    REMOTE=$(git rev-parse "origin/$CURRENT_BRANCH" 2>/dev/null)

    if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
        echo "→ Updating to latest version..."
        git reset --hard "origin/$CURRENT_BRANCH" 2>/dev/null
        git clean -fd 2>/dev/null || true
        echo "✓ Updated to latest version"
    else
        echo "✓ Already up to date"
    fi
else
    echo "⚠ Could not fetch from origin (continuing with existing code)"
fi

if [ "$STASHED" = true ]; then
    echo "→ Restoring stashed changes..."
    git stash pop 2>/dev/null || echo "⚠ Could not restore stashed changes (check: git stash list)"
fi

set -e

echo ""
echo "→ Backing up SQLite database..."
chmod +x scripts/backup-sqlite.sh
./scripts/backup-sqlite.sh || {
  echo "✗ Database backup failed — aborting update"
  exit 1
}
echo ""

echo "→ Installing backend dependencies..."
cd backend
npm ci --omit=dev 2>/dev/null || npm install
echo "→ Running prisma migrate deploy..."
npx prisma generate
npx prisma migrate deploy || {
  echo "✗ Migration failed — aborting (database backup is in ../backups/)"
  exit 1
}
echo "→ Building backend..."
rm -rf dist 2>/dev/null || true
npm run build || {
  echo "✗ Backend build failed — aborting restart"
  exit 1
}
echo "✓ Backend rebuilt"
echo ""

echo "→ Building frontend..."
cd ../frontend
npm ci 2>/dev/null || npm install
rm -rf dist .vite node_modules/.vite 2>/dev/null || true
npm run build || {
  echo "✗ Frontend build failed — aborting restart"
  exit 1
}
echo "✓ Frontend rebuilt"
echo ""

echo "→ Restarting services..."
$SUDO_CMD systemctl restart hourly-backend
sleep 2
$SUDO_CMD systemctl restart hourly-frontend
sleep 2
echo "✓ Services restarted"
echo ""

echo "→ Health check..."
HEALTH_URL="${HOURLY_HEALTH_URL:-http://127.0.0.1:5000/api/health}"
if curl -sf "$HEALTH_URL" >/dev/null; then
  echo "✓ Health check passed ($HEALTH_URL)"
else
  echo "✗ Health check failed ($HEALTH_URL)"
  echo "  Check logs: $SUDO_CMD journalctl -u hourly-backend -n 40"
  exit 1
fi
echo ""

echo "Service Status:"
echo ""

if $SUDO_CMD systemctl is-active --quiet hourly-backend; then
    echo "✓ Backend service is running"
else
    echo "✗ Backend service failed to start"
    echo "  Check logs: $SUDO_CMD journalctl -u hourly-backend -n 20"
fi

if $SUDO_CMD systemctl is-active --quiet hourly-frontend; then
    echo "✓ Frontend service is running"
else
    echo "✗ Frontend service failed to start"
    echo "  Check logs: $SUDO_CMD journalctl -u hourly-frontend -n 20"
fi

echo ""
echo "Update complete!"
echo ""
