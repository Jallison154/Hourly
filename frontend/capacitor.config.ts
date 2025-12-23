import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hourly.app',
  appName: 'Hourly',
  webDir: 'dist',
  server: {
    // For development, you can uncomment this to point to your backend server
    // url: 'http://localhost:5000',
    // cleartext: true
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
