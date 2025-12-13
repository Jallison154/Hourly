import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TimePicker from '../components/TimePicker'
import ManualEntryForm from '../components/ManualEntryForm'
import ActiveTimer from '../components/ActiveTimer'
import WeeklySummary from '../components/WeeklySummary'
import Dialog from '../components/Dialog'
import { timeEntriesAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useDialog } from '../hooks/useDialog'
import { formatDateTime } from '../utils/date'
import type { TimeEntry } from '../types'

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
    
    if (day >= payPeriodEndDay + 1) {
      // Current month's (endDay+1) to next month's endDay
      return {
        start: new Date(year, month, payPeriodEndDay + 1),
        end: new Date(year, month + 1, payPeriodEndDay, 23, 59, 59, 999)
      }
    } else {
      // Previous month's (endDay+1) to current month's endDay
      return {
        start: new Date(year, month - 1, payPeriodEndDay + 1),
        end: new Date(year, month, payPeriodEndDay, 23, 59, 59, 999)
      }
    }
  }
}

// Calculate next pay period
function getNextPayPeriod(
  currentPeriod: { start: Date; end: Date },
  payPeriodType: string = 'monthly',
  payPeriodEndDay: number = 10
): { start: Date; end: Date } {
  if (payPeriodType === 'weekly') {
    // Next week: 7 days after current period
    const nextStart = new Date(currentPeriod.end)
    nextStart.setDate(nextStart.getDate() + 1)
    nextStart.setHours(0, 0, 0, 0)
    
    const nextEnd = new Date(nextStart)
    nextEnd.setDate(nextStart.getDate() + 6)
    nextEnd.setHours(23, 59, 59, 999)
    
    return { start: nextStart, end: nextEnd }
  } else {
    // Next month: start from day after current period end
    const nextStart = new Date(currentPeriod.end)
    nextStart.setDate(nextStart.getDate() + 1)
    nextStart.setHours(0, 0, 0, 0)
    
    // End is endDay of the month after nextStart's month
    // If nextStart is on (endDay+1), then end is endDay of next month
    const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, payPeriodEndDay, 23, 59, 59, 999)
    
    return { start: nextStart, end: nextEnd }
  }
}

export default function ClockInOut() {
  const { user } = useAuth()
  const [status, setStatus] = useState<{ isClockedIn: boolean; entry: TimeEntry | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [clockInTime, setClockInTime] = useState(new Date())
  const [clockOutTime, setClockOutTime] = useState(new Date())
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [daysUntilNextPayPeriod, setDaysUntilNextPayPeriod] = useState<number | null>(null)
  const { dialog, showAlert, showConfirm, closeDialog } = useDialog()

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 5000) // Refresh every 5 seconds for real-time updates
    return () => clearInterval(interval)
  }, [])

  // Calculate days until next pay period
  useEffect(() => {
    if (!user) return
    
    const now = new Date()
    const payPeriodType = user.payPeriodType || 'monthly'
    const payPeriodEndDay = user.payPeriodEndDay || 10
    
    const currentPeriod = getCurrentPayPeriod(now, payPeriodType, payPeriodEndDay)
    const nextPeriod = getNextPayPeriod(currentPeriod, payPeriodType, payPeriodEndDay)
    
    // Calculate days until end of next pay period
    const msUntilEnd = nextPeriod.end.getTime() - now.getTime()
    const daysUntil = Math.ceil(msUntilEnd / (1000 * 60 * 60 * 24))
    
    setDaysUntilNextPayPeriod(daysUntil)
  }, [user])

  const loadStatus = async () => {
    try {
      const data = await timeEntriesAPI.getStatus()
      setStatus(data)
    } catch (error) {
      console.error('Failed to load status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    try {
      const time = useCustomTime ? clockInTime.toISOString() : undefined
      await timeEntriesAPI.clockIn(time)
      await loadStatus()
      setUseCustomTime(false)
      setShowTimePicker(false)
    } catch (error: any) {
      await showAlert('Error', error.response?.data?.error || 'Failed to clock in')
    }
  }

  const handleClockOut = async () => {
    try {
      const time = useCustomTime ? clockOutTime.toISOString() : undefined
      await timeEntriesAPI.clockOut(time)
      await loadStatus()
      setUseCustomTime(false)
      setShowTimePicker(false)
    } catch (error: any) {
      await showAlert('Error', error.response?.data?.error || 'Failed to clock out')
    }
  }

  const handleCancelClockIn = async () => {
    if (!currentEntry) return
    
    const confirmed = await showConfirm(
      'Cancel Clock In',
      'Are you sure you want to cancel this clock-in? This will delete the current time entry.',
      'Cancel Clock In',
      'Keep Clocked In'
    )
    
    if (confirmed) {
      try {
        await timeEntriesAPI.deleteEntry(currentEntry.id)
        await loadStatus()
        await showAlert('Success', 'Clock-in cancelled successfully')
      } catch (error: any) {
        await showAlert('Error', error.response?.data?.error || 'Failed to cancel clock-in')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  const isClockedIn = status?.isClockedIn || false
  const currentEntry = status?.entry

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 sm:pb-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Days Until Next Pay Period */}
        {daysUntilNextPayPeriod !== null && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Days until next pay period ends
                </p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                  {daysUntilNextPayPeriod} {daysUntilNextPayPeriod === 1 ? 'day' : 'days'}
                </p>
              </div>
              <div className="text-4xl">📅</div>
            </div>
          </motion.div>
        )}

        {/* Weekly Summary */}
        <WeeklySummary />

        {/* Active Timer - Prominently displayed when clocked in */}
        {isClockedIn && currentEntry && user && (
          <ActiveTimer entry={currentEntry} user={user} />
        )}

        {/* Main Clock In/Out Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 mb-6"
        >
          {!isClockedIn ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Ready to Start?
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Tap the button below to clock in
                </p>
              </div>

              {/* Custom Time Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    setShowTimePicker(!showTimePicker)
                    setUseCustomTime(!showTimePicker)
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showTimePicker ? 'Use current time' : 'Set custom time'}
                </button>
              </div>

              <AnimatePresence>
                {showTimePicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6"
                  >
                    <TimePicker
                      value={clockInTime}
                      onChange={setClockInTime}
                      label="Clock In Time"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Clock In Button */}
              <motion.button
                onClick={handleClockIn}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-8 rounded-xl text-xl sm:text-2xl shadow-lg transition-colors"
              >
                Clock In
              </motion.button>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Clocked in at {currentEntry && formatDateTime(currentEntry.clockIn)}
                </p>
              </div>

              {/* Custom Time Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    setShowTimePicker(!showTimePicker)
                    setUseCustomTime(!showTimePicker)
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showTimePicker ? 'Use current time' : 'Set custom time'}
                </button>
              </div>

              <AnimatePresence>
                {showTimePicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6"
                  >
                    <TimePicker
                      value={clockOutTime}
                      onChange={setClockOutTime}
                      label="Clock Out Time"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Clock Out Button */}
              <motion.button
                onClick={handleClockOut}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 px-8 rounded-xl text-xl sm:text-2xl shadow-lg transition-colors mb-3"
              >
                Clock Out
              </motion.button>

              {/* Cancel Clock In Button */}
              <motion.button
                onClick={handleCancelClockIn}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg text-base shadow-md transition-colors"
              >
                Cancel Clock In
              </motion.button>
            </>
          )}
        </motion.div>

        {/* Manual Entry Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Manual Entry
            </h2>
            <motion.button
              onClick={() => setShowManualEntry(!showManualEntry)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm sm:text-base transition-colors"
            >
              {showManualEntry ? 'Cancel' : 'Add Entry'}
            </motion.button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Add or edit a time entry if you missed clocking in or out
          </p>

          <AnimatePresence>
            {showManualEntry && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <ManualEntryForm
                  onSuccess={() => {
                    setShowManualEntry(false)
                    loadStatus()
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Dialog */}
      <Dialog
        open={dialog.open}
        onClose={closeDialog}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />
    </div>
  )
}
