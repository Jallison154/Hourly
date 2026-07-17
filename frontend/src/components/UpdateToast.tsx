import { useEffect, useState } from 'react'
import Button from './Button'

/** Shows when a new service worker / app version is waiting. */
export default function UpdateToast() {
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    const handler = () => setWaiting(true)
    window.addEventListener('hourly:sw-update', handler)
    return () => window.removeEventListener('hourly:sw-update', handler)
  }, [])

  if (!waiting) return null

  return (
    <div className="fixed bottom-20 sm:bottom-6 inset-x-4 z-[70] mx-auto max-w-md rounded-2xl border border-okami-border bg-okami-panel p-4 shadow-xl dark:bg-gray-800">
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        A new version of Hourly is available.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Refresh
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setWaiting(false)}>
          Later
        </Button>
      </div>
    </div>
  )
}
