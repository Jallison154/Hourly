#!/bin/bash
# Script to test iPhone connectivity to the Hourly backend

echo "=========================================="
echo "Testing iPhone Connection to Backend"
echo "=========================================="
echo ""

# Get server IPs
echo "Server IP addresses:"
ifconfig | grep -E "inet " | grep -v 127.0.0.1 | awk '{print "  - " $2}'
echo ""

# Test backend health endpoint
echo "Testing backend health endpoint..."
for ip in $(ifconfig | grep -E "inet " | grep -v 127.0.0.1 | awk '{print $2}'); do
  echo "  Testing http://$ip:5000/api/health"
  response=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://$ip:5000/api/health 2>&1)
  http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
  if [ "$http_code" = "200" ]; then
    echo "    ✓ Backend is accessible at http://$ip:5000"
  else
    echo "    ✗ Backend not accessible at http://$ip:5000 (HTTP $http_code)"
  fi
done
echo ""

# Test backend test endpoint
echo "Testing backend test endpoint..."
for ip in $(ifconfig | grep -E "inet " | grep -v 127.0.0.1 | awk '{print $2}'); do
  echo "  Testing http://$ip:5000/api/test"
  response=$(curl -s http://$ip:5000/api/test 2>&1)
  if echo "$response" | grep -q "status.*ok"; then
    echo "    ✓ Test endpoint working at http://$ip:5000"
    echo "    Response: $response"
  else
    echo "    ✗ Test endpoint failed at http://$ip:5000"
    echo "    Response: $response"
  fi
done
echo ""

# Check if backend is listening on all interfaces
echo "Checking backend network binding..."
if lsof -i :5000 | grep -q "0.0.0.0"; then
  echo "  ✓ Backend is listening on 0.0.0.0:5000 (all interfaces)"
else
  echo "  ✗ Backend may not be listening on all interfaces"
  lsof -i :5000
fi
echo ""

# Check frontend
echo "Checking frontend..."
if lsof -i :5173 | grep -q "LISTEN"; then
  echo "  ✓ Frontend is running on port 5173"
  for ip in $(ifconfig | grep -E "inet " | grep -v 127.0.0.1 | awk '{print $2}'); do
    echo "    Access at: http://$ip:5173"
  done
else
  echo "  ✗ Frontend is not running on port 5173"
  echo "    Start with: cd frontend && npm run preview -- --host 0.0.0.0"
fi
echo ""

echo "=========================================="
echo "iPhone Connection Instructions"
echo "=========================================="
echo ""
echo "1. Make sure iPhone is on the same WiFi network"
echo "2. On iPhone Safari, go to one of these URLs:"
for ip in $(ifconfig | grep -E "inet " | grep -v 127.0.0.1 | awk '{print $2}'); do
  echo "   http://$ip:5173"
done
echo ""
echo "3. Check browser console on iPhone (if possible) for API URL"
echo "4. The API URL should be: http://<server-ip>:5000/api"
echo ""
echo "If login still fails, check:"
echo "  - Backend logs: tail -f /tmp/hourly-backend.log"
echo "  - Frontend console for API URL and errors"
echo "  - Network tab in browser dev tools"
echo ""


