# Fix iPhone Login - Step by Step

## Current Status
- ✅ Backend is running on `0.0.0.0:5000` (accessible from network)
- ✅ Backend is responding to requests
- ✅ CORS is configured for mobile access
- ⚠️ Frontend needs to be built and running

## Step 1: Build and Start Frontend

```bash
cd frontend
npm run build
npm run preview -- --host 0.0.0.0
```

This will:
- Build the frontend with the latest API URL detection fixes
- Start the preview server on `0.0.0.0:5173` (accessible from iPhone)

## Step 2: Find Your Server IP

Run this command to see your server IPs:
```bash
ifconfig | grep -E "inet " | grep -v 127.0.0.1
```

You should see something like:
- `192.168.4.5` or
- `192.168.10.65` (the one you mentioned)

## Step 3: Access from iPhone

1. Make sure iPhone is on the **same WiFi network** as your server
2. Open Safari on iPhone
3. Go to: `http://<your-server-ip>:5173`
   - Example: `http://192.168.4.5:5173`
   - Or: `http://192.168.10.65:5173`

## Step 4: Check What Error You're Getting

The "Login Failed" message could mean different things:

### A. Network Error (Can't reach server)
**Symptoms:**
- Error message says "Cannot connect to server"
- Error code: `ERR_NETWORK` or `Failed to fetch`

**Solution:**
- Check backend is running: `ps aux | grep node | grep backend`
- Check firewall allows port 5000
- Verify iPhone and server are on same WiFi

### B. Invalid Credentials
**Symptoms:**
- Error message says "Invalid email or password"
- Error status: `401`

**Solution:**
- Double-check your email and password
- Try creating a new account if you don't have one
- Check backend logs: `tail -f /tmp/hourly-backend.log`

### C. CORS Error
**Symptoms:**
- Error message mentions CORS
- Error status: `0` or no response

**Solution:**
- Backend CORS is already configured, but check backend logs
- Try disabling "Prevent Cross-Site Tracking" in Safari settings

### D. Wrong API URL
**Symptoms:**
- Error shows wrong URL (like `localhost:5000` from iPhone)

**Solution:**
- Check browser console on iPhone (if possible)
- The API URL should be: `http://<server-ip>:5000/api`
- If it shows `localhost`, the detection isn't working

## Step 5: Debug on iPhone

### Option A: Safari Web Inspector (if you have a Mac)
1. Connect iPhone to Mac via USB
2. On iPhone: Settings → Safari → Advanced → Web Inspector (ON)
3. On Mac: Safari → Preferences → Advanced → Show Develop menu
4. On Mac: Safari → Develop → [Your iPhone] → [Page]
5. Check Console tab for errors and API URL

### Option B: Check Backend Logs
```bash
tail -f /tmp/hourly-backend.log
```

When you try to login, you should see:
- "Login attempt from: <origin>"
- "Login attempt for email: <email>"
- Either "Login successful" or "Login failed: <reason>"

## Step 6: Manual API URL Override (if auto-detection fails)

If the API URL detection isn't working, manually set it:

1. Create `.env` file in `frontend/` directory:
   ```bash
   cd frontend
   echo "VITE_API_URL=http://192.168.4.5:5000/api" > .env
   ```
   (Replace `192.168.4.5` with your actual server IP)

2. Rebuild:
   ```bash
   npm run build
   npm run preview -- --host 0.0.0.0
   ```

## Common Issues

### Issue: "Cannot connect to server"
- **Check:** Backend running? `ps aux | grep node | grep backend`
- **Check:** Firewall blocking port 5000?
- **Check:** Same WiFi network?

### Issue: "Invalid credentials"
- **Check:** Are you using the correct email/password?
- **Check:** Backend logs show login attempts?
- **Try:** Create a new account to test

### Issue: API URL is wrong
- **Check:** Browser console shows what API URL is being used
- **Fix:** Use manual `.env` override (Step 6 above)

## Quick Test

Test backend directly from iPhone Safari:
1. Go to: `http://<server-ip>:5000/api/health`
2. Should see: `{"status":"ok"}`

If this works, backend is reachable. If not, it's a network/firewall issue.

## Still Not Working?

1. **Check backend logs:**
   ```bash
   tail -50 /tmp/hourly-backend.log
   ```

2. **Check if login requests are reaching backend:**
   - Look for "Login attempt from:" in logs
   - If you don't see this, requests aren't reaching the backend

3. **Verify API URL in frontend:**
   - Check browser console
   - Should show: `http://<server-ip>:5000/api`
   - NOT: `http://localhost:5000/api`

4. **Test with curl from iPhone's network:**
   ```bash
   curl -X POST http://<server-ip>:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"your@email.com","password":"yourpassword"}'
   ```
