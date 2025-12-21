import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { timeEntriesAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { formatHours } from '../utils/date'
import type { TimeEntry } from '../types'

interface WeeklySummaryData {
  hoursWorked: number
  overtimeHours: number
  hoursLeft: number
  daysWorked: number
  consecutiveDays: number
}

// Calculate current pay period
function getCurrentPayPeriod(
  date: Date = new Date(),
  payPeriodType: string = 'monthly',
  payPeriodEndDay: number = 10
): { start: Date; end: Date } {
  if (payPeriodType === 'weekly') {
    // Weekly: Sunday to Saturday (7 days)
    const dayOfWeek = date.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
    const daysToSunday = dayOfWeek === 0 ? 0 : dayOfWeek
    const sunday = new Date(date)
    sunday.setDate(date.getDate() - daysToSunday)
    sunday.setHours(0, 0, 0, 0)
    
    const saturday = new Date(sunday)
    saturday.setDate(sunday.getDate() + 6)
    saturday.setHours(23, 59, 59, 999)
    
    return { start: sunday, end: saturday }
  } else {
    // Monthly: (endDay+1) to endDay of next month
    const day = date.getDate()
    const month = date.getMonth()
    const year = date.getFullYear()
    
    if (day > payPeriodEndDay) {
      // We're past the endDay, so current period is: this month's (endDay+1) to next month's endDay
      // Example: If today is Dec 15 and endDay is 10, period is Dec 11 to Jan 10
      return {
        start: new Date(year, month, payPeriodEndDay + 1, 0, 0, 0, 0),
        end: new Date(year, month + 1, payPeriodEndDay, 23, 59, 59, 999)
      }
    } else {
      // We're on or before the endDay, so current period is: previous month's (endDay+1) to this month's endDay
      // Example: If today is Dec 10 and endDay is 10, period is Nov 11 to Dec 10
      return {
        start: new Date(year, month - 1, payPeriodEndDay + 1, 0, 0, 0, 0),
        end: new Date(year, month, payPeriodEndDay, 23, 59, 59, 999)
      }
    }
  }
}

export default function WeeklySummary() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<WeeklySummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [daysUntilNextPayPeriod, setDaysUntilNextPayPeriod] = useState<number | null>(null)
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null)

  // Load current clock status for live updates
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const status = await timeEntriesAPI.getStatus()
        setCurrentEntry(status.isClockedIn ? status.entry : null)
      } catch (error) {
        console.error('Failed to load clock status:', error)
      }
    }
    loadStatus()
    const statusInterval = setInterval(loadStatus, 5000) // Check every 5 seconds
    return () => clearInterval(statusInterval)
  }, [])

  useEffect(() => {
    loadWeeklySummary()
    const interval = setInterval(loadWeeklySummary, currentEntry ? 1000 : 30000) // Update every second if clocked in, every 30 seconds otherwise
    return () => clearInterval(interval)
  }, [currentEntry])

  // Calculate days until end of current pay period
  useEffect(() => {
    if (!user) return
    
    const now = new Date()
    const payPeriodType = user.payPeriodType || 'monthly'
    const payPeriodEndDay = user.payPeriodEndDay || 10
    
    const currentPeriod = getCurrentPayPeriod(now, payPeriodType, payPeriodEndDay)
    
    // Calculate days until end of current pay period
    const msUntilEnd = currentPeriod.end.getTime() - now.getTime()
    const daysUntil = Math.ceil(msUntilEnd / (1000 * 60 * 60 * 24))
    
    setDaysUntilNextPayPeriod(daysUntil)
  }, [user])

  const loadWeeklySummary = async () => {
    try {
      // Get current week (Sunday to Saturday)
      const now = new Date()
      const dayOfWeek = now.getDay()
      // Calculate days to subtract to get to Sunday (0=Sunday, 1=Monday, ..., 6=Saturday)
      // If it's Sunday (0), go back 0 days. Otherwise, go back dayOfWeek days.
      const daysToSunday = dayOfWeek === 0 ? 0 : dayOfWeek
      const sunday = new Date(now)
      sunday.setDate(now.getDate() - daysToSunday)
      sunday.setHours(0, 0, 0, 0)

      const saturday = new Date(sunday)
      saturday.setDate(sunday.getDate() + 6) // Saturday is 6 days after Sunday (7 days total: Sun to Sat)
      saturday.setHours(23, 59, 59, 999)

      // Get entries for this week
      // The API should return all entries in the date range, regardless of pay period
      // This ensures we get entries from previous pay period if the week spans pay periods
      const allEntries = await timeEntriesAPI.getEntries(
        sunday.toISOString(),
        saturday.toISOString()
      )
      
      // Filter to ensure we only count entries that actually fall within the week
      // (in case the API returns entries slightly outside the range)
      const entries = allEntries.filter(entry => {
        const entryDate = new Date(entry.clockIn)
        return entryDate >= sunday && entryDate <= saturday
      })

      // Calculate hours worked this week
      // This includes ALL entries in the week, even if they're from previous pay period
      let hoursWorked = 0
      const workedDates = new Set<string>()
      
      entries.forEach((entry) => {
        if (entry.clockOut) {
          const clockIn = new Date(entry.clockIn)
          const clockOut = new Date(entry.clockOut)
          const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
          const breakHours = (entry.totalBreakMinutes || 0) / 60
          const workedHours = hours - breakHours
          hoursWorked += workedHours
          
          // Track unique dates worked this week (use local date to avoid timezone issues)
          const dateKey = `${clockIn.getFullYear()}-${String(clockIn.getMonth() + 1).padStart(2, '0')}-${String(clockIn.getDate()).padStart(2, '0')}`
          workedDates.add(dateKey)
        }
      })

      // Add current active entry hours if clocked in and entry is in this week
      if (currentEntry && !currentEntry.clockOut) {
        const entryDate = new Date(currentEntry.clockIn)
        if (entryDate >= sunday && entryDate <= saturday) {
          const now = new Date()
          const hours = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60)
          const breakHours = (currentEntry.totalBreakMinutes || 0) / 60
          const workedHours = hours - breakHours
          hoursWorked += Math.max(0, workedHours)
        }
      }

      // Calculate overtime (hours over 40)
      const overtimeHours = Math.max(0, hoursWorked - 40)
      
      // Calculate hours left until 40 (can be negative for overtime)
      const hoursLeft = 40 - hoursWorked

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
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 mb-4"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        This Week
      </h2>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Hours Worked</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatHours(summary.hoursWorked)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Overtime</div>
          <div className={`text-xl font-bold ${summary.overtimeHours > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
            {formatHours(summary.overtimeHours)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Hours Left</div>
          <div className={`text-xl font-bold ${
            summary.hoursLeft < 0 
              ? 'text-orange-600 dark:text-orange-400' 
              : summary.hoursLeft <= 5 && summary.hoursLeft > 0 
                ? 'text-yellow-600 dark:text-yellow-400' 
                : summary.hoursLeft === 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-gray-900 dark:text-white'
          }`}>
            {summary.hoursLeft < 0 ? `-${formatHours(Math.abs(summary.hoursLeft))}` : formatHours(summary.hoursLeft)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Days Worked</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {summary.daysWorked}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Days in a Row</div>
          <div className={`text-xl font-bold ${summary.consecutiveDays >= 5 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
            {summary.consecutiveDays}
          </div>
        </div>
        {daysUntilNextPayPeriod !== null && (
          <div className="text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Days till end of pay period</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {daysUntilNextPayPeriod}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

