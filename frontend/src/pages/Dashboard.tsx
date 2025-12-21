import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { metricsAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatHours } from '../utils/date'
import type { Metrics } from '../types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartView, setChartView] = useState<'daily' | 'weekly' | 'yearly'>('daily')

  useEffect(() => {
    loadMetrics()
  }, [])

  const loadMetrics = async () => {
    try {
      const data = await metricsAPI.getMetrics()
      setMetrics(data)
    } catch (error) {
      console.error('Failed to load metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Failed to load metrics</div>
      </div>
    )
  }

  // Prepare chart data based on selected view
  const getChartData = () => {
    if (chartView === 'daily') {
      return Object.entries(metrics.dailyHours)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, hours]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          hours
        }))
    } else if (chartView === 'weekly') {
      return Object.entries(metrics.weeklyHours)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, hours]) => {
          // Parse week format: YYYY-Www
          const [year, weekNum] = week.split('-W')
          const weekStart = new Date(parseInt(year), 0, 1)
          const daysToAdd = (parseInt(weekNum) - 1) * 7
          weekStart.setDate(weekStart.getDate() + daysToAdd - weekStart.getDay())
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 6)
          return {
            date: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            hours
          }
        })
    } else {
      return Object.entries(metrics.yearlyHours)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, hours]) => ({
          date: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          hours
        }))
    }
  }

  const chartData = getChartData()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:pb-8" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex justify-between items-center"
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <div className="flex-1"></div>
        <Link
          to="/profile"
          className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
        >
          {user?.profileImage ? (
            <img
              src={user.profileImage}
              alt={user?.name || 'Profile'}
              className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 font-semibold border-2 border-gray-300 dark:border-gray-600">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </Link>
      </motion.div>

      {/* Combined Metrics Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Hours</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatHours(metrics.currentPeriod.totalHours)}
            </div>
            {metrics.currentPeriod.overtimeHours > 0 && (
              <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                {formatHours(metrics.currentPeriod.overtimeHours)} overtime
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Gross Pay</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(metrics.currentPeriod.grossPay)}
            </div>
            {metrics.currentPeriod.overtimePay > 0 && (
              <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                +{formatCurrency(metrics.currentPeriod.overtimePay)} OT
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Pay</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {formatCurrency(metrics.currentPeriod.netPay)}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Hours/Day</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatHours(metrics.currentPeriod.avgHoursPerDay)}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Pay Breakdown Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Pay Breakdown
        </h2>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Regular Hours</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatHours(metrics.currentPeriod.regularHours)}
            </span>
          </div>
          {metrics.currentPeriod.overtimeHours > 0 && (
            <div className="flex justify-between border-l-4 border-orange-500 pl-3">
              <span className="text-orange-600 dark:text-orange-400 font-medium">Overtime Hours (1.5x)</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {formatHours(metrics.currentPeriod.overtimeHours)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Regular Pay</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(metrics.currentPeriod.regularPay)}
            </span>
          </div>
          {metrics.currentPeriod.overtimePay > 0 && (
            <div className="flex justify-between border-l-4 border-orange-500 pl-3">
              <span className="text-orange-600 dark:text-orange-400 font-medium">Overtime Pay (1.5x rate)</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {formatCurrency(metrics.currentPeriod.overtimePay)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2">
            <span className="text-gray-600 dark:text-gray-400">Gross Pay</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(metrics.currentPeriod.grossPay)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Federal Tax</span>
            <span className="text-gray-900 dark:text-white">
              {formatCurrency(metrics.currentPeriod.federalTax)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">State Tax (MT)</span>
            <span className="text-gray-900 dark:text-white">
              {formatCurrency(metrics.currentPeriod.stateTax)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">FICA</span>
            <span className="text-gray-900 dark:text-white">
              {formatCurrency(metrics.currentPeriod.fica)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold">
            <span className="text-gray-900 dark:text-white">Net Pay</span>
            <span className="text-blue-600 dark:text-blue-400">
              {formatCurrency(metrics.currentPeriod.netPay)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Hours Graph Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {chartView === 'daily' ? 'Daily Hours' : chartView === 'weekly' ? 'Weekly Hours' : 'Monthly Hours'}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setChartView('daily')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                chartView === 'daily'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setChartView('weekly')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                chartView === 'weekly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setChartView('yearly')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                chartView === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="hours" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>


    </div>
  )
}

