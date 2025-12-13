# iPhone Login Fix - Complete Guide

## Issues Found and Fixed

Based on research and code review, here are the main issues causing iPhone login failures:

### 1. **Safari CORS Requirements**
- Safari requires explicit origin handling, not just `origin: true`
- Fixed: Updated CORS to use a callback function that explicitly allows all origins
- Added proper preflight handling for OPTIONS requests

### 2. **API URL Detection**
- The frontend needs to correctly detect when it's on a mobile device
- Fixed: Improved API URL detection to properly handle IP addresses
- Added better logging to debug connection issues

### 3. **Safari-Specific Issues**
- Safari's "Prevent Cross-Site Tracking" can interfere
- Safari requires explicit headers and protocols

## Steps to Fix on Your iPhone

### Step 1: Safari Settings
1. Go to **Settings** → **Safari**
2. Turn OFF **"Prevent Cross-Site Tracking"** (temporarily for testing)
3. Turn OFF **"Block All Cookies"** (if enabled)
4. Clear Safari cache: **Settings** → **Safari** → **Clear History and Website Data**

### Step 2: Rebuild and Restart
On your server, rebuild the frontend with the latest fixes:

```bash
cd frontend
npm run build
npm run preview -- --host 0.0.0.0
```

### Step 3: Test Connection
On your iPhone, test the backend directly:
- Open Safari
- Go to: `http://192.168.10.65:5000/api/health`
- You should see: `{"status":"ok"}`

### Step 4: Try Login
- Go to: `http://192.168.10.65:5173`
- Open Safari Developer Tools (if connected to Mac) or check console
- Try logging in
- Check console for API URL being used

## Manual API URL Override

If auto-detection still doesn't work, manually set it:

1. **Create `.env` file in frontend directory:**
   ```bash
   cd frontend
   echo "VITE_API_URL=http://192.168.10.65:5000/api" > .env
   ```

2. **Rebuild:**
   ```bash
   npm run build
   npm run preview -- --host 0.0.0.0
   ```

## Debugging

### Check Browser Console on iPhone
1. Connect iPhone to Mac
2. On Mac: Safari → Preferences → Advanced → Show Develop menu
3. On iPhone: Settings → Safari → Advanced → Web Inspector (ON)
4. On Mac: Safari → Develop → [Your iPhone] → [Page]
5. Check Console tab for errors

### Common Errors and Solutions

**Error: "Cannot connect to server"**
- Backend not running: `cd backend && npm run dev`
- Wrong IP address: Verify server IP is `192.168.10.65`
- Firewall blocking: Check firewall allows port 5000

**Error: "CORS error"**
- Backend CORS config updated (should be fixed now)
- Try disabling "Prevent Cross-Site Tracking" in Safari

**Error: "Network Error" or "ERR_CONNECTION_REFUSED"**
- API URL is wrong - check console logs
- Use manual override with `.env` file

## What Was Changed

### Backend (`backend/src/index.ts`)
- Updated CORS to use explicit origin callback (Safari-compatible)
- Added proper preflight handling
- Added more explicit headers

### Frontend (`frontend/src/services/api.ts`)
- Improved API URL detection for mobile devices
- Better error logging
- More detailed error messages

## Testing Checklist

- [ ] Backend is running on `0.0.0.0:5000`
- [ ] Frontend is running on `0.0.0.0:5173`
- [ ] Can access `http://192.168.10.65:5000/api/health` from iPhone
- [ ] Can access `http://192.168.10.65:5173` from iPhone
- [ ] Safari settings adjusted (cross-site tracking off)
- [ ] Console shows correct API URL: `http://192.168.10.65:5000/api`
- [ ] Login attempt shows detailed error if it fails

## Still Not Working?

1. **Check server logs:**
   ```bash
   # Backend logs
   tail -f /tmp/hourly-backend.log
   
   # Or if using systemd
   sudo journalctl -u hourly-backend -f
   ```

2. **Check network:**
   - iPhone and server on same WiFi network?
   - Can ping server from iPhone?
   - Firewall allows connections?

3. **Try different browser:**
   - Install Chrome on iPhone
   - Try logging in there
   - If Chrome works, it's a Safari-specific issue

4. **Check API URL in console:**
   - Should show: `http://192.168.10.65:5000/api`
   - If it shows `localhost`, the detection isn't working
   - Use manual `.env` override




