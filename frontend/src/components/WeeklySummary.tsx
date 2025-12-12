import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { timeEntriesAPI } from '../services/api'
import { formatHours } from '../utils/date'

interface WeeklySummaryData {
  hoursWorked: number
  overtimeHours: number
  hoursLeft: number
  daysWorked: number
  consecutiveDays: number
}

export default function WeeklySummary() {
  const [summary, setSummary] = useState<WeeklySummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWeeklySummary()
    const interval = setInterval(loadWeeklySummary, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadWeeklySummary = async () => {
    try {
      // Get current week (Monday to Sunday)
      const now = new Date()
      const dayOfWeek = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
      monday.setHours(0, 0, 0, 0)
      
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)

      // Get entries for this week
      const entries = await timeEntriesAPI.getEntries(
        monday.toISOString(),
        sunday.toISOString()
      )

      // Calculate hours worked this week
      let hoursWorked = 0
      const workedDates = new Set<string>()
      entries.forEach((entry) => {
        if (entry.clockOut) {
          const clockIn = new Date(entry.clockIn)
          const clockOut = new Date(entry.clockOut)
          const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
          const breakHours = (entry.totalBreakMinutes || 0) / 60
          hoursWorked += hours - breakHours
          
          // Track unique dates worked this week (use local date to avoid timezone issues)
          const dateKey = `${clockIn.getFullYear()}-${String(clockIn.getMonth() + 1).padStart(2, '0')}-${String(clockIn.getDate()).padStart(2, '0')}`
          workedDates.add(dateKey)
        }
      })

      // Calculate overtime (hours over 40)
      const overtimeHours = Math.max(0, hoursWorked - 40)
      
      // Calculate hours left until 40
      const hoursLeft = Math.max(0, 40 - hoursWorked)

      // Count days worked this week
      const daysWorked = workedDates.size

      // Calculate consecutive days worked (check backwards from today)
      let consecutiveDays = 0
      let checkDate = new Date()
      checkDate.setHours(0, 0, 0, 0)
      
      // Get recent entries to check consecutive days (last 30 days should be enough)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      thirtyDaysAgo.setHours(0, 0, 0, 0)
      
      const recentEntries = await timeEntriesAPI.getEntries(
        thirtyDaysAgo.toISOString(),
        new Date().toISOString()
      )
      
      const allWorkedDates = new Set<string>()
      recentEntries.forEach((entry) => {
        if (entry.clockOut) {
          const clockIn = new Date(entry.clockIn)
          // Use local date to avoid timezone issues
          const dateKey = `${clockIn.getFullYear()}-${String(clockIn.getMonth() + 1).padStart(2, '0')}-${String(clockIn.getDate()).padStart(2, '0')}`
          allWorkedDates.add(dateKey)
        }
      })
      
      // Check backwards from today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      let currentCheck = new Date(today)
      
      // Skip today if it's before the start of the day (like if checking early morning)
      const todayKey = `${currentCheck.getFullYear()}-${String(currentCheck.getMonth() + 1).padStart(2, '0')}-${String(currentCheck.getDate()).padStart(2, '0')}`
      if (!allWorkedDates.has(todayKey)) {
        // If today hasn't been worked yet, start from yesterday
        currentCheck.setDate(currentCheck.getDate() - 1)
      }
      
      // Count consecutive days backwards
      while (true) {
        const dateKey = `${currentCheck.getFullYear()}-${String(currentCheck.getMonth() + 1).padStart(2, '0')}-${String(currentCheck.getDate()).padStart(2, '0')}`
        if (allWorkedDates.has(dateKey)) {
          consecutiveDays++
          currentCheck.setDate(currentCheck.getDate() - 1)
        } else {
          break
        }
      }

      setSummary({
        hoursWorked,
        overtimeHours,
        hoursLeft,
        daysWorked,
        consecutiveDays
      })
    } catch (error) {
      console.error('Failed to load weekly summary:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6"
      >
        <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
      </motion.div>
    )
  }

  if (!summary) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6"
    >
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        This Week
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Hours Worked</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatHours(summary.hoursWorked)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overtime</div>
          <div className={`text-2xl font-bold ${summary.overtimeHours > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
            {formatHours(summary.overtimeHours)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Hours Left</div>
          <div className={`text-2xl font-bold ${summary.hoursLeft <= 5 && summary.hoursLeft > 0 ? 'text-yellow-600 dark:text-yellow-400' : summary.hoursLeft === 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
            {formatHours(summary.hoursLeft)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Days Worked This Week</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary.daysWorked}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Days in a Row</div>
          <div className={`text-2xl font-bold ${summary.consecutiveDays >= 5 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
            {summary.consecutiveDays}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

