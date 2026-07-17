import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  metricsAPI,
  timeEntriesAPI,
  timesheetAPI,
  timesheetsAPI,
  userAPI,
} from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { formatHours } from '../utils/date'
import type { Metrics, TimeEntry, WeeklySchedule } from '../types'
import PullToRefresh from '../components/PullToRefresh'
import Button from '../components/Button'

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

function startOfLocalDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfLocalDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function weekBounds(now = new Date(), workweekStartDay = 0) {
  const day = now.getDay()
  const delta = (day - workweekStartDay + 7) % 7
  const start = startOfLocalDay(now)
  start.setDate(start.getDate() - delta)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function hoursFromEntry(entry: TimeEntry, now = new Date()) {
  const clockIn = new Date(entry.clockIn)
  const clockOut = entry.clockOut ? new Date(entry.clockOut) : now
  const raw = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
  return Math.max(0, raw - (entry.totalBreakMinutes || 0) / 60)
}

export default function Home() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [todayHours, setTodayHours] = useState(0)
  const [weekHours, setWeekHours] = useState(0)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null)
  const [timesheetStatus, setTimesheetStatus] = useState<string | null>(null)
  const [recent, setRecent] = useState<TimeEntry[]>([])
  const [now, setNow] = useState(() => new Date())

  const otThreshold = user?.overtimeThresholdHours ?? 40
  const hoursLeft = otThreshold - weekHours

  const nextShiftLabel = useMemo(() => {
    if (!schedule) return 'No schedule set'
    const today = new Date().getDay()
    for (let i = 0; i < 7; i++) {
      const dayIndex = (today + i) % 7
      const key = DAY_KEYS[dayIndex]
      const hours = Number(schedule[key] ?? 0)
      if (hours > 0) {
        const date = new Date()
        date.setDate(date.getDate() + i)
        const dayName = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        return i === 0
          ? `Today · ${formatHours(hours)} planned`
          : `${dayName} · ${formatHours(hours)} planned`
      }
    }
    return 'No upcoming planned hours'
  }, [schedule])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const status = await timeEntriesAPI.getStatus()
      setIsClockedIn(Boolean(status.isClockedIn))
      setActiveEntry(status.isClockedIn ? status.entry : null)

      const { start: weekStart, end: weekEnd } = weekBounds(
        new Date(),
        user?.workweekStartDay ?? 0
      )
      const todayStart = startOfLocalDay()
      const todayEnd = endOfLocalDay()

      const [weekEntries, metricsData, scheduleData, periods] = await Promise.all([
        timeEntriesAPI.getEntries(weekStart.toISOString(), weekEnd.toISOString()),
        metricsAPI.getMetrics().catch(() => null),
        userAPI.getSchedule().catch(() => null),
        timesheetAPI.getPayPeriods().catch(() => []),
      ])

      setMetrics(metricsData)
      setSchedule(scheduleData)

      const current = new Date()
      let todayTotal = 0
      let weekTotal = 0
      const seen = new Set<string>()
      for (const entry of weekEntries) {
        seen.add(entry.id)
        const h = hoursFromEntry(entry, current)
        weekTotal += h
        const cin = new Date(entry.clockIn)
        if (cin >= todayStart && cin <= todayEnd) todayTotal += h
      }
      if (status.isClockedIn && status.entry && !seen.has(status.entry.id)) {
        const h = hoursFromEntry(status.entry, current)
        weekTotal += h
        const cin = new Date(status.entry.clockIn)
        if (cin >= todayStart && cin <= todayEnd) todayTotal += h
      }
      setTodayHours(todayTotal)
      setWeekHours(weekTotal)

      const sorted = [...weekEntries]
        .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime())
        .slice(0, 5)
      setRecent(sorted)

      if (periods.length > 0) {
        const currentPeriod = periods[0]
        try {
          const ts = await timesheetsAPI.getCurrent(currentPeriod.start, currentPeriod.end)
          setTimesheetStatus(ts?.status ?? ts?.timesheet?.status ?? null)
        } catch {
          setTimesheetStatus(null)
        }
      }
    } catch (err) {
      console.error('Failed to load home:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.workweekStartDay])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!isClockedIn) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [isClockedIn])

  const liveShiftLabel = useMemo(() => {
    if (!activeEntry) return null
    const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(activeEntry.clockIn).getTime()) / 1000))
    const h = Math.floor(elapsed / 3600)
    const m = Math.floor((elapsed % 3600) / 60)
    const s = elapsed % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }, [activeEntry, now])

  const payPeriodProgress = metrics?.currentPeriod
  const periodHours = payPeriodProgress?.totalHours ?? 0

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-okami-muted">
        Loading…
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="mx-auto max-w-3xl px-4 py-6 page-with-nav sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                Home
              </h1>
              <p className="mt-1 text-sm text-okami-muted">
                {user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'Your day at a glance'}
              </p>
            </div>
            <Link
              to="/"
              className="shrink-0 rounded-xl bg-okami-accent px-3 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Open Clock
            </Link>
          </div>

          {/* Clock status */}
          <section className="mb-4 rounded-2xl border border-okami-border bg-okami-panel p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-okami-muted">
                  Clock status
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  {isClockedIn ? 'Clocked in' : 'Clocked out'}
                </p>
                {liveShiftLabel && (
                  <p className="mt-0.5 font-mono text-sm text-okami-accent">{liveShiftLabel}</p>
                )}
              </div>
              <span
                className={`inline-flex h-3 w-3 rounded-full ${
                  isClockedIn ? 'bg-okami-success animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                aria-hidden
              />
            </div>
          </section>

          {/* Hours summary */}
          <section className="mb-4 grid grid-cols-2 gap-3">
            <StatCard label="Today" value={formatHours(todayHours)} />
            <StatCard label="This week" value={formatHours(weekHours)} />
            <StatCard
              label="Until OT"
              value={
                hoursLeft > 0
                  ? formatHours(hoursLeft)
                  : `${formatHours(Math.abs(hoursLeft))} OT`
              }
              accent={hoursLeft <= 0}
            />
            <StatCard
              label="Pay period"
              value={formatHours(periodHours)}
              hint={
                metrics?.payPeriod
                  ? `${new Date(metrics.payPeriod.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(metrics.payPeriod.end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : undefined
              }
            />
          </section>

          {/* Next shift + timesheet */}
          <section className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-okami-border bg-okami-panel p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-okami-muted">
                Next scheduled
              </p>
              <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                {nextShiftLabel}
              </p>
              <Link to="/schedule" className="mt-2 inline-block text-sm font-medium text-okami-accent">
                View schedule
              </Link>
            </div>
            <div className="rounded-2xl border border-okami-border bg-okami-panel p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-okami-muted">
                Timesheet
              </p>
              <p className="mt-1 text-base font-semibold capitalize text-gray-900 dark:text-white">
                {timesheetStatus ? String(timesheetStatus).toLowerCase() : 'Open'}
              </p>
              <Link to="/timesheet" className="mt-2 inline-block text-sm font-medium text-okami-accent">
                Open timesheet
              </Link>
            </div>
          </section>

          {/* Recent activity */}
          <section className="mb-4 rounded-2xl border border-okami-border bg-okami-panel p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent activity</h2>
              <Link to="/timesheet" className="text-sm font-medium text-okami-accent">
                All entries
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-okami-muted">No entries this week yet.</p>
            ) : (
              <ul className="divide-y divide-okami-border">
                {recent.map((entry) => {
                  const cin = new Date(entry.clockIn)
                  const hours = hoursFromEntry(entry, now)
                  return (
                    <li key={entry.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900 dark:text-white">
                          {cin.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-okami-muted">
                          {cin.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          {entry.clockOut
                            ? ` – ${new Date(entry.clockOut).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                            : ' – now'}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium text-gray-800 dark:text-gray-200">
                        {formatHours(hours)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/dashboard" className="flex-1">
              <Button variant="secondary" size="md" fullWidth>
                Detailed metrics
              </Button>
            </Link>
            <Link to="/" className="flex-1">
              <Button variant="primary" size="md" fullWidth>
                {isClockedIn ? 'Go to Clock' : 'Clock in'}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </PullToRefresh>
  )
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-okami-border bg-okami-panel p-3.5 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-okami-muted">{label}</p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums ${
          accent ? 'text-okami-accent' : 'text-gray-900 dark:text-white'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-okami-muted">{hint}</p>}
    </div>
  )
}
