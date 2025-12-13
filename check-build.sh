#!/bin/bash

# Script to check if the frontend build contains the latest code

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/frontend"

echo "=========================================="
echo "Checking Frontend Build"
echo "=========================================="
echo ""

# Check if dist exists
if [ ! -d "dist" ]; then
    echo "✗ dist directory does not exist - build hasn't been run"
    exit 1
fi

echo "→ Checking if 'Add Entry' text exists in build..."
echo ""

# Check in HTML
if grep -r "Add Entry" dist/ 2>/dev/null | head -1; then
    echo "✓ Found 'Add Entry' in build files"
    FOUND=true
else
    echo "✗ 'Add Entry' NOT found in build files"
    FOUND=false
fi

echo ""
echo "→ Checking build timestamp..."
if [ -f "dist/index.html" ]; then
    BUILD_TIME=$(stat -c %y dist/index.html 2>/dev/null || stat -f "%Sm" dist/index.html 2>/dev/null)
    echo "  Build time: $BUILD_TIME"
else
    echo "  ✗ dist/index.html not found"
fi

echo ""
echo "→ Checking source file..."
if grep -q "Add Entry" src/pages/Timesheet.tsx 2>/dev/null; then
    echo "✓ 'Add Entry' exists in source code (src/pages/Timesheet.tsx)"
else
    echo "✗ 'Add Entry' NOT found in source code"
fi

echo ""
if [ "$FOUND" = false ]; then
    echo "⚠ ISSUE DETECTED: Build does not contain 'Add Entry'"
    echo ""
    echo "Try rebuilding:"
    echo "  cd frontend"
    echo "  rm -rf dist .vite node_modules/.vite"
    echo "  npm run build"
    echo "  sudo systemctl restart hourly-frontend"
else
    echo "✓ Build looks good - 'Add Entry' is present"
    echo ""
    echo "If you still don't see it in the browser:"
    echo "  1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
    echo "  2. Clear browser cache"
    echo "  3. Check browser console for errors"
fi

echo ""


