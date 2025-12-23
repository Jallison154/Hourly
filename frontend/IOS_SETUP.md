# iOS Setup Guide for Hourly App

This guide will help you open and run the Hourly app in Xcode.

## Prerequisites

1. **Xcode** (latest version recommended)
2. **CocoaPods** (usually comes with Xcode, but you may need to install it)
3. **Node.js** and npm (already installed if you've been developing)

## Opening the Project in Xcode

1. Navigate to the iOS project:
   ```bash
   cd ios/App
   ```

2. Install CocoaPods dependencies (if not already done):
   ```bash
   pod install
   ```

3. Open the workspace (NOT the .xcodeproj file):
   ```bash
   open App.xcworkspace
   ```
   
   Or simply double-click `App.xcworkspace` in Finder.

## Configuring the Backend API

The iOS app needs to connect to your backend server. You have a few options:

### Option 1: Local Development (Same Network)

1. Find your Mac's local IP address:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Or check System Preferences > Network

2. Update the API URL in `frontend/src/services/api.ts`:
   - Look for the `VITE_NATIVE_API_URL` environment variable
   - Or modify the default in the `getApiUrl()` function
   - Set it to: `http://YOUR_IP_ADDRESS:5000/api` (e.g., `http://192.168.1.100:5000/api`)

3. Rebuild and sync:
   ```bash
   cd frontend
   npm run build
   npx cap sync ios
   ```

### Option 2: Environment Variable

Create a `.env` file in the `frontend` directory:
```
VITE_NATIVE_API_URL=http://YOUR_IP_ADDRESS:5000/api
```

Then rebuild and sync as above.

### Option 3: Production Backend

If you have a deployed backend, set the URL to your production API endpoint.

## Running the App

1. In Xcode, select a simulator or connected device from the device selector at the top
2. Click the "Run" button (▶️) or press `Cmd + R`
3. The app will build and launch

## Important Notes

- **Backend Server**: Make sure your backend server is running on port 5000 (or your configured port)
- **Network**: For local development, your iOS device/simulator must be on the same network as your Mac
- **HTTPS**: iOS requires HTTPS for production apps. For development, you can use HTTP, but you may need to configure App Transport Security settings in Xcode
- **Rebuild**: After making changes to the frontend code, always run `npm run build` and `npx cap sync ios` before running in Xcode

## App Transport Security (ATS) Configuration

If you're using HTTP (not HTTPS) for local development, you may need to configure ATS:

1. In Xcode, open `ios/App/App/Info.plist`
2. Add or modify the `NSAppTransportSecurity` dictionary:
   ```xml
   <key>NSAppTransportSecurity</key>
   <dict>
       <key>NSAllowsArbitraryLoads</key>
       <true/>
   </dict>
   ```

**Warning**: Only use this for development. For production, use HTTPS.

## Troubleshooting

### Build Errors
- Make sure CocoaPods dependencies are installed: `cd ios/App && pod install`
- Clean build folder in Xcode: `Product > Clean Build Folder` (Shift + Cmd + K)

### Network Errors
- Verify your backend is running: `curl http://localhost:5000/api/health` (if you have a health endpoint)
- Check your Mac's firewall settings
- Ensure your device/simulator is on the same network

### Sync Issues
- Always run `npx cap sync ios` after building the frontend
- If changes don't appear, try deleting `ios/App/App/public` and syncing again

## Development Workflow

1. Make changes to React code in `frontend/src/`
2. Build: `cd frontend && npm run build`
3. Sync: `npx cap sync ios`
4. Run in Xcode: Open Xcode and run the app

## Next Steps

- Configure app icons and splash screens
- Set up code signing for device deployment
- Configure push notifications (if needed)
- Set up App Store Connect for distribution

