import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { adminAPI, type AdminDashboard, type AdminDashboardUser } from '../services/api'
import { formatHours } from '../utils/date'
import { format, parseISO } from 'date-fns'
import PullToRefresh from '../components/PullToRefresh'

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

  // Not logged in as admin: show login
  if (!adminToken) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Admin</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Enter the admin password to view the dashboard.
          </p>
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Admin password"
                autoComplete="current-password"
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-600 dark:text-red-400">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg"
            >
              {loading ? 'Checking...' : 'Log in'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full mt-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm"
          >
            ← Back to app login
          </button>
        </motion.div>
      </div>
    )
  }

  // Dashboard
  const weekStart = dashboard?.workWeek?.start ? format(parseISO(dashboard.workWeek.start), 'MMM d, yyyy') : '—'
  const weekEnd = dashboard?.workWeek?.end ? format(parseISO(dashboard.workWeek.end), 'MMM d, yyyy') : '—'

  return (
    <PullToRefresh onRefresh={loadDashboard}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Work week: {weekStart} – {weekEnd}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={loadDashboard}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Log out
              </button>
            </div>
          </div>

          {dashboardError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {dashboardError}
            </div>
          )}

          {dashboard && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                        Email
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Week Hours
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Hours Left
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {dashboard.users.map((user: AdminDashboardUser) => (
                      <tr key={user.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                          {user.email}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {user.isClockedIn ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                              Clocked in
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              Out
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white tabular-nums">
                          {formatHours(user.currentWeekHours)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums">
                          <span className={user.hoursLeft >= 0 ? 'text-gray-900 dark:text-white' : 'text-orange-600 dark:text-orange-400 font-medium'}>
                            {user.hoursLeft >= 0 ? formatHours(user.hoursLeft) : `-${formatHours(-user.hoursLeft)} OT`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dashboard.users.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No users found.
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </PullToRefresh>
  )
}
