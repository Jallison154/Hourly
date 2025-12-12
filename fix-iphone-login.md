# iPhone Login Fix Guide

## Quick Fix Steps

1. **Rebuild the frontend** to include the updated API URL detection:
   ```bash
   cd frontend
   npm run build
   ```

2. **Restart both servers**:
   ```bash
   # Backend (in one terminal)
   cd backend
   npm run dev
   
   # Frontend (in another terminal)
   cd frontend
   npm run preview -- --host 0.0.0.0
   ```

3. **On your iPhone**, open Safari and go to: `http://192.168.10.65:5173`

4. **Test the connection**:
   - Open Safari Developer Tools (if available) or check the Network tab
   - Look for console logs showing the API URL being used
   - The API URL should be: `http://192.168.10.65:5000/api`

## Manual API URL Override

If auto-detection isn't working, you can manually set the API URL:

1. **Create a `.env` file in the frontend directory**:
   ```bash
   cd frontend
   echo "VITE_API_URL=http://192.168.10.65:5000/api" > .env
   ```

2. **Rebuild the frontend**:
   ```bash
   npm run build
   ```

3. **Restart the preview server**:
   ```bash
   npm run preview -- --host 0.0.0.0
   ```

## Testing Connectivity

1. **Test backend directly from iPhone**:
   - Open Safari on iPhone
   - Go to: `http://192.168.10.65:5000/api/health`
   - You should see: `{"status":"ok"}`

2. **Test backend test endpoint**:
   - Go to: `http://192.168.10.65:5000/api/test`
   - You should see connection details

3. **Check browser console**:
   - On iPhone Safari, enable Web Inspector (Settings → Safari → Advanced → Web Inspector)
   - Connect iPhone to Mac and use Safari's Develop menu
   - Check console for API URL and any errors

## Common Issues

### Issue: "Network Error" or "Cannot connect to server"
- **Solution**: Make sure the backend is running and listening on `0.0.0.0:5000`
- Check: `lsof -i :5000` should show the backend process

### Issue: "CORS error"
- **Solution**: The backend CORS is configured to allow all origins. If you still see CORS errors, check:
  - Backend is running the latest code with updated CORS config
  - No firewall blocking port 5000

### Issue: API URL is still "localhost"
- **Solution**: 
  - Clear browser cache on iPhone
  - Rebuild frontend: `cd frontend && npm run build`
  - Use manual override with `.env` file (see above)

### Issue: Login returns 401 but credentials are correct
- **Solution**: Check backend logs for authentication errors
- Verify the user exists in the database
- Check JWT_SECRET is set in backend `.env`

## Debug Information

The frontend now includes extensive logging:
- API URL detection logs
- Request/response logs
- Error details with full URLs

Check the browser console on your iPhone to see what's happening.


