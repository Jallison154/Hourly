import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { timeEntriesAPI } from '../services/api'
import type { TimeEntry } from '../types'

export type ClockNavStatus = {
  isClockedIn: boolean
  onBreak: boolean
  entry: TimeEntry | null
}

function isOnBreak(entry: TimeEntry | null | undefined): boolean {
  if (!entry?.breaks?.length) return false
  return entry.breaks.some((b) => !b.endTime)
}

/** Shared clock status for mobile + desktop bottom navigation. */
export function useClockNavStatus(): ClockNavStatus {
  const location = useLocation()
  const [status, setStatus] = useState<ClockNavStatus>({
    isClockedIn: false,
    onBreak: false,
    entry: null,
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const data = await timeEntriesAPI.getStatus()
        if (cancelled) return
        const entry = data.isClockedIn ? (data.entry as TimeEntry) : null
        setStatus({
          isClockedIn: Boolean(data.isClockedIn),
          onBreak: Boolean(data.isClockedIn) && isOnBreak(entry),
          entry,
        })
      } catch {
        // Silent — nav remains usable offline
      }
    }

    load()
    const interval = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [location.pathname])

  return status
}
