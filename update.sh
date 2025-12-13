#!/bin/bash

# Quick script to update from git, rebuild, and restart Hourly services

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Updating Hourly from Git"
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

# Temporarily disable exit on error for git operations
set +e

# Stash any local changes
if ! git diff --quiet 2>/dev/null || ! git diff --staged --quiet 2>/dev/null; then
    echo "→ Stashing local changes..."
    git stash push -m "Auto-stash before update.sh $(date +%Y-%m-%d_%H:%M:%S)" 2>/dev/null
    STASHED=true
else
    STASHED=false
fi

# Fetch and update
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

# Restore stashed changes if any
if [ "$STASHED" = true ]; then
    echo "→ Restoring stashed changes..."
    git stash pop 2>/dev/null || echo "⚠ Could not restore stashed changes (check: git stash list)"
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
rm -rf dist .vite 2>/dev/null || true
npm run build
echo "✓ Frontend rebuilt"
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

