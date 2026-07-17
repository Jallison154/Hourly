import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['logo-icon.svg', 'logo.svg'],
      minify: false,
      workbox: {
        mode: 'development',
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Never cache authenticated API responses across users
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'Hourly',
        short_name: 'Hourly',
        description: 'Time tracking and paycheck calculator by Okami Designs',
        theme_color: '#141210',
        background_color: '#141210',
        display: 'standalone',
        icons: [
          {
            src: 'logo-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    })
  ],
  server: {
    host: '0.0.0.0', // Listen on all interfaces for mobile access
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0', // Allow mobile access to preview server
    port: 5173
  }
})


