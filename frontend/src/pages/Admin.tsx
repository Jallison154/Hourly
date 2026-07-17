import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { adminAPI, type AdminDashboard, type AdminDashboardUser } from '../services/api'
import { formatHours } from '../utils/date'
import { format, parseISO } from 'date-fns'
import PullToRefresh from '../components/PullToRefresh'
import { useAuth } from '../hooks/useAuth'
import { UserGroupIcon } from '@heroicons/react/24/outline'

export default function Admin() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [dashboardError, setDashboardError] = useState('')
  const [filter, setFilter] = useState<
    'all' | 'in' | 'out' | 'ot' | 'long' | 'break' | 'pending'
  >('all')

  const canAccess =
    user?.role === 'ADMIN' || user?.role === 'MANAGER'

  useEffect(() => {
    if (!canAccess) return
    loadDashboard()
    const interval = setInterval(loadDashboard, 15000)
    return () => clearInterval(interval)
  }, [canAccess])

  const loadDashboard = async () => {
    setDashboardError('')
    try {
      const data = await adminAPI.getDashboard()
      setDashboard(data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; userMessage?: string }
      setDashboardError(err.userMessage || err.response?.data?.error || 'Failed to load dashboard')
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-okami-bg flex items-center justify-center text-okami-muted">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!canAccess) return <Navigate to="/" replace />

  const weekStart = dashboard?.workWeek?.start
    ? format(parseISO(dashboard.workWeek.start), 'MMM d')
    : '—'
  const weekEnd = dashboard?.workWeek?.end
    ? format(parseISO(dashboard.workWeek.end), 'MMM d, yyyy')
    : '—'

  const filteredUsers =
    dashboard?.users.filter((u) => {
      if (filter === 'in') return u.isClockedIn
      if (filter === 'out') return !u.isClockedIn
      if (filter === 'ot') return (u.overtimeHours ?? 0) > 0 || u.hoursLeft < 0
      if (filter === 'long') return !!u.unusuallyLongShift
      if (filter === 'break') return !!u.onBreak
      if (filter === 'pending') return (u.pendingTimesheets ?? 0) > 0
      return true
    }) ?? []

  return (
    <PullToRefresh onRefresh={loadDashboard}>
      <div className="min-h-screen bg-okami-bg pb-28 sm:pb-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-4 gap-3"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-gray-900 dark:text-white">
                {user.role === 'ADMIN' ? 'Admin' : 'Team'} Dashboard
              </h1>
              <p className="text-xs text-okami-muted mt-1">
                {weekStart} – {weekEnd}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm font-medium text-okami-muted hover:text-okami-accent min-h-[44px]"
            >
              Back
            </button>
          </motion.div>

          {dashboardError && (
            <div className="mb-4 p-4 rounded-xl border border-okami-danger/40 bg-red-50 dark:bg-red-900/20 text-sm text-okami-danger">
              {dashboardError}
            </div>
          )}

          {dashboard && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {[
                  ['Clocked in', dashboard.summary?.clockedIn ?? 0],
                  ['On break', dashboard.summary?.onBreak ?? 0],
                  ['Overtime', dashboard.summary?.inOvertime ?? 0],
                  ['Long open', dashboard.summary?.missingClockOut ?? 0],
                  ['Awaiting approval', dashboard.summary?.awaitingApproval ?? 0],
                  ['Team', dashboard.users.length],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-panel bg-okami-panel border border-okami-border p-3 shadow-panel"
                  >
                    <div className="text-xs text-okami-muted">{label}</div>
                    <div className="text-xl font-bold tabular-nums">{value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-panel bg-okami-panel border border-okami-border shadow-panel overflow-hidden">
                <div className="px-4 py-3 border-b border-okami-border space-y-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <UserGroupIcon className="w-5 h-5 text-okami-muted" />
                    People
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['all', 'All'],
                        ['in', 'In'],
                        ['out', 'Out'],
                        ['break', 'Break'],
                        ['ot', 'OT'],
                        ['long', 'Long shift'],
                        ['pending', 'Approvals'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          filter === key
                            ? 'border-okami-accent text-okami-accent bg-orange-50 dark:bg-orange-950/30'
                            : 'border-okami-border text-okami-muted'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="divide-y divide-okami-border">
                  {filteredUsers.map((u: AdminDashboardUser) => (
                    <div key={u.id} className="px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold break-words">{u.name}</p>
                          <p className="text-sm text-okami-muted break-all">{u.email}</p>
                          <p className="text-xs text-okami-muted mt-1">
                            {u.role}
                            {!u.isActive ? ' · Inactive' : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3 text-right">
                          <div>
                            {u.isClockedIn ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-okami-success">
                                <span className="w-2 h-2 rounded-full bg-okami-success animate-pulse" />
                                {u.onBreak ? 'Break' : 'In'}
                              </span>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-okami-muted">
                                Out
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-okami-muted">Week</div>
                            <div className="text-sm font-semibold tabular-nums">
                              {formatHours(u.currentWeekHours)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-okami-muted">Left / OT</div>
                            <div
                              className={`text-sm font-semibold tabular-nums ${
                                u.hoursLeft < 0 ? 'text-okami-accent' : ''
                              }`}
                            >
                              {u.hoursLeft >= 0
                                ? formatHours(u.hoursLeft)
                                : `${formatHours(u.overtimeHours ?? -u.hoursLeft)} OT`}
                            </div>
                          </div>
                        </div>
                      </div>
                      {u.unusuallyLongShift && (
                        <p className="mt-2 text-xs text-okami-warning">
                          Long open shift ({u.openShiftHours?.toFixed(1)}h)
                        </p>
                      )}
                      {(u.pendingTimesheets ?? 0) > 0 && (
                        <p className="mt-1 text-xs text-okami-accent">
                          {u.pendingTimesheets} timesheet(s) awaiting approval
                        </p>
                      )}
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="px-4 py-12 text-center text-sm text-okami-muted">
                      No employees match this filter.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PullToRefresh>
  )
}
