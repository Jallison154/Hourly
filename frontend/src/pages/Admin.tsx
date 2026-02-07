import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { adminAPI, type AdminDashboard, type AdminDashboardUser } from '../services/api'
import { formatHours } from '../utils/date'
import { format, parseISO } from 'date-fns'
import PullToRefresh from '../components/PullToRefresh'
import { UserGroupIcon } from '@heroicons/react/24/outline'
import { UserGroupIcon as UserGroupIconSolid } from '@heroicons/react/24/solid'

const ADMIN_STORAGE_KEY = 'hourly_admin_token'

export default function Admin() {
  const navigate = useNavigate()
  const [adminToken, setAdminToken] = useState<string | null>(() => sessionStorage.getItem(ADMIN_STORAGE_KEY))
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [dashboardError, setDashboardError] = useState('')

  useEffect(() => {
    if (adminToken) {
      loadDashboard()
    }
  }, [adminToken])

  useEffect(() => {
    if (!adminToken) return
    const interval = setInterval(loadDashboard, 15000)
    return () => clearInterval(interval)
  }, [adminToken])

  const loadDashboard = async () => {
    if (!adminToken) return
    setDashboardError('')
    try {
      const data = await adminAPI.getDashboard(adminToken)
      setDashboard(data)
    } catch (e: unknown) {
      const err = e as { response?: { status: number; data?: { error?: string } } }
      if (err.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_STORAGE_KEY)
        setAdminToken(null)
      }
      setDashboardError(err.response?.data?.error || 'Failed to load dashboard')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoading(true)
    try {
      await adminAPI.login(password)
      sessionStorage.setItem(ADMIN_STORAGE_KEY, password)
      setAdminToken(password)
      setPassword('')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setLoginError(err.response?.data?.error || 'Invalid password')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminToken(null)
    setDashboard(null)
  }

  if (!adminToken) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4">
                <UserGroupIconSolid className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Admin</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter the admin password to view the team dashboard.
              </p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Admin password"
                  autoComplete="current-password"
                />
              </div>
              {loginError && (
                <p className="text-sm text-red-600 dark:text-red-400">{loginError}</p>
              )}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.99 }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-lg transition-colors"
              >
                {loading ? 'Checking...' : 'Log in'}
              </motion.button>
            </form>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full mt-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              ← Back to app login
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  const weekStart = dashboard?.workWeek?.start ? format(parseISO(dashboard.workWeek.start), 'MMM d') : '—'
  const weekEnd = dashboard?.workWeek?.end ? format(parseISO(dashboard.workWeek.end), 'MMM d, yyyy') : '—'
  const clockedInCount = dashboard?.users?.filter(u => u.isClockedIn).length ?? 0

  return (
    <PullToRefresh onRefresh={loadDashboard}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-4"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Team Dashboard
            </h1>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Log out
            </button>
          </motion.div>

          {dashboardError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm"
            >
              {dashboardError}
            </motion.div>
          )}

          {dashboard && (
            <>
              {/* Summary card - like WeeklySummary on Clock page */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 mb-4"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  This Week
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {weekStart} – {weekEnd} (Sun–Sat)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center py-2 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Team</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {dashboard.users.length}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">users</div>
                  </div>
                  <div className="text-center py-2 rounded-xl bg-green-50 dark:bg-green-900/20">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Clocked In</div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {clockedInCount}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">now</div>
                  </div>
                  <div className="text-center py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Total Hours</div>
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {dashboard.users.length > 0
                        ? formatHours(dashboard.users.reduce((sum, u) => sum + (u.currentWeekHours || 0), 0))
                        : '0:00'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">this week</div>
                  </div>
                </div>
              </motion.div>

              {/* User list card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
              >
                <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <UserGroupIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    Team members
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {dashboard.users.map((user: AdminDashboardUser, index: number) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className="px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {user.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate sm:block hidden">
                            {user.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6">
                          <div className="flex items-center gap-2">
                            {user.isClockedIn ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                In
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                Out
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Hours</div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                              {formatHours(user.currentWeekHours)}
                            </div>
                          </div>
                          <div className="text-right min-w-[4rem]">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Left</div>
                            <div
                              className={`text-sm font-semibold tabular-nums ${
                                user.hoursLeft >= 0
                                  ? 'text-gray-900 dark:text-white'
                                  : 'text-orange-600 dark:text-orange-400'
                              }`}
                            >
                              {user.hoursLeft >= 0
                                ? formatHours(user.hoursLeft)
                                : `-${formatHours(-user.hoursLeft)} OT`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {dashboard.users.length === 0 && (
                  <div className="px-4 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No users found.
                  </div>
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>
    </PullToRefresh>
  )
}
