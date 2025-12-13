#!/bin/bash

# Quick fix script for mobile access issues

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Fixing Mobile Access"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    SUDO_CMD=""
else
    SUDO_CMD="sudo"
fi

# 1. Stop current backend
echo "→ Stopping current backend..."
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -f "node.*dist/index.js" 2>/dev/null || true
sleep 2
echo "✓ Backend stopped"
echo ""

# 2. Rebuild backend
echo "→ Rebuilding backend..."
cd backend
npm run build
echo "✓ Backend rebuilt"
echo ""

# 3. Update .env to ensure HOST is set
if ! grep -q "HOST=" .env 2>/dev/null; then
    echo "HOST=0.0.0.0" >> .env
    echo "✓ Added HOST=0.0.0.0 to .env"
fi
echo ""

# 4. Start backend with correct host
echo "→ Starting backend on 0.0.0.0:5000..."
cd "$SCRIPT_DIR/backend"
HOST=0.0.0.0 PORT=5000 node dist/index.js > /tmp/hourly-backend.log 2>&1 &
BACKEND_PID=$!
sleep 2

if ps -p $BACKEND_PID > /dev/null; then
    echo "✓ Backend started (PID: $BACKEND_PID)"
    echo "  Logs: tail -f /tmp/hourly-backend.log"
else
    echo "✗ Backend failed to start"
    echo "  Check logs: cat /tmp/hourly-backend.log"
    exit 1
fi
echo ""

# 5. Rebuild frontend
echo "→ Rebuilding frontend..."
cd "$SCRIPT_DIR/frontend"
npm run build
echo "✓ Frontend rebuilt"
echo ""

# 6. Start frontend preview
echo "→ Starting frontend preview on 0.0.0.0:5173..."
npm run preview -- --host 0.0.0.0 > /tmp/hourly-frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 2

if ps -p $FRONTEND_PID > /dev/null; then
    echo "✓ Frontend started (PID: $FRONTEND_PID)"
    echo "  Logs: tail -f /tmp/hourly-frontend.log"
else
    echo "✗ Frontend failed to start"
    echo "  Check logs: cat /tmp/hourly-frontend.log"
fi
echo ""

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ip route get 1.1.1.1 | awk '{print $7; exit}' 2>/dev/null || echo "192.168.10.65")

echo "=========================================="
echo "Services are running!"
echo "=========================================="
echo ""
echo "Access from iPhone:"
echo "  Frontend: http://$SERVER_IP:5173"
echo "  Backend: http://$SERVER_IP:5000"
echo ""
echo "To stop services:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""





