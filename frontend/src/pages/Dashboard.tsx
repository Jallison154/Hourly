import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { metricsAPI } from '../services/api'
import { formatCurrency, formatHours } from '../utils/date'
import type { Metrics } from '../types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

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

  const chartData = Object.entries(metrics.dailyHours).map(([date, hours]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    hours
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 sm:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Pay Period: {new Date(metrics.payPeriod.start).toLocaleDateString()} - {new Date(metrics.payPeriod.end).toLocaleDateString()}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Hours</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {formatHours(metrics.currentPeriod.totalHours)}
            </div>
            {metrics.currentPeriod.overtimeHours > 0 && (
              <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                {formatHours(metrics.currentPeriod.overtimeHours)} overtime
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Gross Pay</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {formatCurrency(metrics.currentPeriod.grossPay)}
            </div>
            {metrics.currentPeriod.overtimePay > 0 && (
              <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                +{formatCurrency(metrics.currentPeriod.overtimePay)} OT
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Pay</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {formatCurrency(metrics.currentPeriod.netPay)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Hours/Day</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {formatHours(metrics.currentPeriod.avgHoursPerDay)}
            </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Daily Hours
            </h2>
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
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
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
      >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              to="/clock"
              className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center font-semibold transition-colors"
            >
              ⏰ Clock In/Out
            </Link>
            <Link
              to="/timesheet"
              className="p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-center font-semibold transition-colors"
            >
              📋 View Timesheet
            </Link>
            <Link
              to="/calculator"
              className="p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-center font-semibold transition-colors"
            >
              💰 Paycheck Calculator
            </Link>
        </div>
      </motion.div>
    </div>
  )
}

