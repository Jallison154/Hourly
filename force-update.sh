#!/bin/bash

# Force update script - pulls latest from git, rebuilds, and restarts

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Force Updating Hourly from Git"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    SUDO_CMD=""
else
    SUDO_CMD="sudo"
fi

# Check if this is a git repository
if [ ! -d ".git" ]; then
    echo "Error: Not a git repository"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
echo "Current branch: $CURRENT_BRANCH"
echo ""

# Show current commit
echo "→ Current commit:"
git log -1 --oneline
echo ""

# Temporarily disable exit on error for git operations
set +e

# Stash any local changes
if ! git diff --quiet 2>/dev/null || ! git diff --staged --quiet 2>/dev/null; then
    echo "→ Stashing local changes..."
    git stash push -m "Auto-stash before force-update.sh $(date +%Y-%m-%d_%H:%M:%S)" 2>/dev/null
    STASHED=true
else
    STASHED=false
fi

# Fetch latest changes
echo "→ Fetching latest changes from origin..."
git fetch origin --prune 2>&1
if [ $? -ne 0 ]; then
    echo "✗ Failed to fetch from origin"
    echo "  Check your internet connection and git remote"
    exit 1
fi

# Show what's on remote
echo ""
echo "→ Remote commit:"
git log -1 origin/$CURRENT_BRANCH --oneline 2>/dev/null || echo "Could not get remote commit"
echo ""

# Force reset to origin
echo "→ Force resetting to origin/$CURRENT_BRANCH..."
git reset --hard origin/$CURRENT_BRANCH 2>&1
if [ $? -ne 0 ]; then
    echo "✗ Failed to reset to origin"
    exit 1
fi

# Clean untracked files
echo "→ Cleaning untracked files..."
git clean -fd 2>/dev/null || true

# Show new commit
echo ""
echo "→ New commit after update:"
git log -1 --oneline
echo ""

# Restore stashed changes if any
if [ "$STASHED" = true ]; then
    echo "→ Restoring stashed changes..."
    git stash pop 2>/dev/null || echo "⚠ Could not restore stashed changes"
fi

# Re-enable exit on error
set -e

echo ""
echo "→ Rebuilding backend..."
cd backend
rm -rf dist 2>/dev/null || true
npm run build
echo "✓ Backend rebuilt"
echo ""

echo "→ Rebuilding frontend..."
cd ../frontend
rm -rf dist .vite node_modules/.vite 2>/dev/null || true
npm run build
echo "✓ Frontend rebuilt"
echo ""

# Verify Add Entry is in build
echo "→ Verifying build contains 'Add Entry'..."
if grep -r "Add Entry" dist/ 2>/dev/null | head -1 > /dev/null; then
    echo "✓ 'Add Entry' found in build"
else
    echo "⚠ 'Add Entry' NOT found in build - this is a problem!"
fi
echo ""

echo "→ Restarting services..."
$SUDO_CMD systemctl restart hourly-backend
sleep 2
$SUDO_CMD systemctl restart hourly-frontend
sleep 2
echo "✓ Services restarted"
echo ""

# Check status
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
echo "Access the app at:"
echo "  Frontend: http://192.168.10.65:5173"
echo "  Backend: http://192.168.10.65:5000"
echo ""
echo "If you still don't see changes:"
echo "  1. Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R)"
echo "  2. Clear browser cache"
echo ""


