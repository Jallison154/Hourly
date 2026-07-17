import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA: notify UI when a new service worker is waiting
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.ready.then((reg) => {
    if (reg.waiting) {
      window.dispatchEvent(new Event('hourly:sw-update'))
    }
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing
      if (!sw) return
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          window.dispatchEvent(new Event('hourly:sw-update'))
        }
      })
    })
  })
}
