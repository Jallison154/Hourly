import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TimePicker from '../components/TimePicker'
import ManualEntryForm from '../components/ManualEntryForm'
import ActiveTimer from '../components/ActiveTimer'
import WeeklySummary from '../components/WeeklySummary'
import Dialog from '../components/Dialog'
import PullToRefresh from '../components/PullToRefresh'
import { timeEntriesAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useDialog } from '../hooks/useDialog'
import { formatDateTime } from '../utils/date'
import type { TimeEntry } from '../types'

export default function ClockInOut() {
  const { user } = useAuth()
  const [status, setStatus] = useState<{ isClockedIn: boolean; entry: TimeEntry | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [clockInTime, setClockInTime] = useState(new Date())
  const [clockOutTime, setClockOutTime] = useState(new Date())
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [showBreakDialog, setShowBreakDialog] = useState(false)
  const [customBreakMinutes, setCustomBreakMinutes] = useState('')
  const [isClockingIn, setIsClockingIn] = useState(false)
  const [isClockingOut, setIsClockingOut] = useState(false)
  const { dialog, showAlert, showConfirm, closeDialog } = useDialog()

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 5000) // Refresh every 5 seconds for real-time updates
    return () => clearInterval(interval)
  }, [])

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
    if (isClockingIn) return
    setIsClockingIn(true)
    try {
      const time = useCustomTime ? clockInTime.toISOString() : undefined
      await timeEntriesAPI.clockIn(time)
      await loadStatus()
      setUseCustomTime(false)
      setShowTimePicker(false)
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string }; status?: number }; message?: string }
      const message =
        axiosError.response?.data?.error ||
        (axiosError.response?.status === 500 ? 'Server error. Please try again.' : 'Failed to clock in. Please try again.')
      await showAlert('Error', message)
    } finally {
      setIsClockingIn(false)
    }
  }

  const handleClockOut = async () => {
    // Show break dialog first
    setShowBreakDialog(true)
  }

  const handleBreakSelected = async (minutes: number | null) => {
    setShowBreakDialog(false)
    if (isClockingOut) return
    setIsClockingOut(true)
    try {
      const time = useCustomTime ? clockOutTime.toISOString() : undefined
      await timeEntriesAPI.clockOut(time, minutes || undefined)
      await loadStatus()
      setUseCustomTime(false)
      setShowTimePicker(false)
      setCustomBreakMinutes('')
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string }; status?: number } }
      const message =
        axiosError.response?.data?.error ||
        (axiosError.response?.status === 500 ? 'Server error. Please try again.' : 'Failed to clock out. Please try again.')
      await showAlert('Error', message)
    } finally {
      setIsClockingOut(false)
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
      } catch (error: unknown) {
        const axiosError = error as { response?: { data?: { error?: string } } }
        await showAlert('Error', axiosError.response?.data?.error || 'Failed to cancel clock-in')
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
    <PullToRefresh onRefresh={loadStatus}>
      <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 sm:pb-8" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-3 sm:py-6 h-full overflow-y-auto overscroll-y-contain">
        {/* Weekly Summary */}
        <WeeklySummary />

        {/* Active Timer - Prominently displayed when clocked in */}
        {isClockedIn && currentEntry && user && (
          <ActiveTimer entry={currentEntry} user={user} />
        )}

        {/* Main Clock In/Out Section */}
        {!isClockedIn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 mb-4 sm:mb-6"
          >
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Ready to Start?
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Tap the button below to clock in
              </p>
            </div>

            {/* Custom Time Toggle */}
            <div className="mb-3 flex justify-center sm:justify-start">
              <motion.button
                type="button"
                onClick={() => {
                  setShowTimePicker(!showTimePicker)
                  setUseCustomTime(!showTimePicker)
                }}
                whileTap={{ scale: 0.97, opacity: 0.7 }}
                transition={{ duration: 0.1 }}
                className="min-h-[44px] px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 active:opacity-70 sm:text-xs sm:font-normal sm:hover:underline"
              >
                {showTimePicker ? 'Use current time' : 'Set custom time'}
              </motion.button>
            </div>

            <AnimatePresence>
              {showTimePicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
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
              type="button"
              onClick={handleClockIn}
              disabled={isClockingIn}
              whileHover={isClockingIn ? undefined : { scale: 1.02 }}
              whileTap={isClockingIn ? undefined : { scale: 0.97, opacity: 0.9 }}
              transition={{ duration: 0.1 }}
              className="w-full min-h-[52px] bg-green-600 hover:bg-green-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl text-lg sm:text-xl shadow-lg transition-colors"
            >
              {isClockingIn ? 'Clocking in…' : 'Clock In'}
            </motion.button>
          </motion.div>
        )}

        {/* Clocked In Section */}
        {isClockedIn && currentEntry && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 mb-4 sm:mb-6"
          >
            <div className="text-center mb-4">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Clocked in at {formatDateTime(currentEntry.clockIn)}
              </p>
            </div>

            {/* Custom Time Toggle */}
            <div className="mb-3 flex justify-center sm:justify-start">
              <motion.button
                type="button"
                onClick={() => {
                  setShowTimePicker(!showTimePicker)
                  setUseCustomTime(!showTimePicker)
                }}
                whileTap={{ scale: 0.97, opacity: 0.7 }}
                transition={{ duration: 0.1 }}
                className="min-h-[44px] px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 active:opacity-70 sm:text-xs sm:font-normal sm:hover:underline"
              >
                {showTimePicker ? 'Use current time' : 'Set custom time'}
              </motion.button>
            </div>

            <AnimatePresence>
              {showTimePicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
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
              type="button"
              onClick={handleClockOut}
              disabled={isClockingOut}
              whileHover={isClockingOut ? undefined : { scale: 1.02 }}
              whileTap={isClockingOut ? undefined : { scale: 0.97, opacity: 0.9 }}
              transition={{ duration: 0.1 }}
              className="w-full min-h-[52px] bg-red-600 hover:bg-red-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl text-lg sm:text-xl shadow-lg transition-colors mb-2"
            >
              {isClockingOut ? 'Clocking out…' : 'Clock Out'}
            </motion.button>

            {/* Cancel Clock In Button */}
            <motion.button
              onClick={handleCancelClockIn}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97, opacity: 0.9 }}
              transition={{ duration: 0.1 }}
              className="w-full min-h-[48px] bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl text-sm shadow-md transition-colors sm:py-2 sm:rounded-lg"
            >
              Cancel Clock In
            </motion.button>
          </motion.div>
        )}

        {/* Manual Entry Section - Only show when not clocked in */}
        {!isClockedIn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8"
          >
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              Manual Entry
            </h2>
            <motion.button
              onClick={() => setShowManualEntry(!showManualEntry)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97, opacity: 0.9 }}
              transition={{ duration: 0.1 }}
              className="min-h-[44px] w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors sm:w-auto sm:rounded-lg sm:text-base sm:py-2"
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
        )}

      {/* Break Selection Dialog */}
      {showBreakDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-gray-800 sm:rounded-2xl sm:p-6"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl mb-4">
              Did you take a break today?
            </h2>
            <div className="space-y-3 mb-4">
              <motion.button
                type="button"
                onClick={() => handleBreakSelected(15)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="min-h-[48px] w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
              >
                15 minutes
              </motion.button>
              <motion.button
                type="button"
                onClick={() => handleBreakSelected(30)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="min-h-[48px] w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
              >
                30 minutes
              </motion.button>
              <motion.button
                type="button"
                onClick={() => handleBreakSelected(60)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="min-h-[48px] w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
              >
                1 hour
              </motion.button>
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom (minutes)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={customBreakMinutes}
                    onChange={(e) => setCustomBreakMinutes(e.target.value)}
                    placeholder="Enter minutes"
                    className="min-h-[48px] flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:min-h-0 sm:rounded-lg sm:py-2"
                  />
                  <motion.button
                    type="button"
                    onClick={() => {
                      const minutes = parseInt(customBreakMinutes)
                      if (!isNaN(minutes) && minutes >= 0) {
                        handleBreakSelected(minutes)
                      }
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={!customBreakMinutes || isNaN(parseInt(customBreakMinutes))}
                    className="min-h-[48px] shrink-0 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:rounded-lg sm:py-2"
                  >
                    Use
                  </motion.button>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={() => handleBreakSelected(null)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-2 min-h-[48px] w-full rounded-xl bg-gray-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-700"
              >
                No break
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

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
      </div>
    </PullToRefresh>
  )
}
