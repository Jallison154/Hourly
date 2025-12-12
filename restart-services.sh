#!/bin/bash

# Quick script to rebuild and restart Hourly services

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Restarting Hourly Services"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    SUDO_CMD=""
else
    SUDO_CMD="sudo"
fi

# Rebuild backend
echo "→ Rebuilding backend..."
cd backend
npm run build
echo "✓ Backend rebuilt"
echo ""

# Rebuild frontend
echo "→ Rebuilding frontend..."
cd ../frontend
npm run build
echo "✓ Frontend rebuilt"
echo ""

# Restart services
echo "→ Restarting services..."
$SUDO_CMD systemctl restart hourly-backend
sleep 2
$SUDO_CMD systemctl restart hourly-frontend
sleep 2

# Check status
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
echo "Access the app at:"
echo "  Frontend: http://192.168.10.65:5173"
echo "  Backend: http://192.168.10.65:5000"
echo ""

