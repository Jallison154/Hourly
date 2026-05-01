import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TimePicker from '../components/TimePicker'
import ManualEntryForm from '../components/ManualEntryForm'
import ActiveTimer from '../components/ActiveTimer'
import WeeklySummary from '../components/WeeklySummary'
import Dialog from '../components/Dialog'
import Button from '../components/Button'
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
            <Button
              type="button"
              variant="success"
              size="lg"
              fullWidth
              loading={isClockingIn}
              onClick={handleClockIn}
              className="shadow-lg"
            >
              {isClockingIn ? 'Clocking in…' : 'Clock In'}
            </Button>
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
            <Button
              type="button"
              variant="danger"
              size="lg"
              fullWidth
              loading={isClockingOut}
              onClick={handleClockOut}
              className="mb-2 shadow-lg"
            >
              {isClockingOut ? 'Clocking out…' : 'Clock Out'}
            </Button>

            {/* Cancel Clock In Button */}
            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              onClick={handleCancelClockIn}
            >
              Cancel Clock In
            </Button>
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
            <Button
              type="button"
              variant={showManualEntry ? 'secondary' : 'primary'}
              size="md"
              fullWidth
              onClick={() => setShowManualEntry(!showManualEntry)}
              className="sm:!w-auto"
            >
              {showManualEntry ? 'Cancel' : 'Add Entry'}
            </Button>
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

      {/* Break Selection Sheet */}
      <AnimatePresence>
        {showBreakDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowBreakDialog(false)}
            />
            <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 pointer-events-none">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="break-sheet-title"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="
                  pointer-events-auto relative flex max-h-[90dvh] w-full flex-col
                  rounded-t-3xl bg-white shadow-2xl
                  dark:bg-gray-800
                  sm:max-w-md sm:rounded-2xl
                "
                style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-center pt-2 pb-1 sm:hidden">
                  <div className="h-1.5 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                <div className="flex-1 overflow-y-auto px-5 pt-2 sm:pt-6">
                  <h2
                    id="break-sheet-title"
                    className="mb-1 text-xl font-bold text-gray-900 dark:text-white"
                  >
                    Did you take a break today?
                  </h2>
                  <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
                    Pick a duration to subtract from your shift.
                  </p>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <Button variant="primary" size="md" onClick={() => handleBreakSelected(15)}>
                      15 min
                    </Button>
                    <Button variant="primary" size="md" onClick={() => handleBreakSelected(30)}>
                      30 min
                    </Button>
                    <Button variant="primary" size="md" onClick={() => handleBreakSelected(60)}>
                      1 hour
                    </Button>
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                      Custom
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        value={customBreakMinutes}
                        onChange={(e) => setCustomBreakMinutes(e.target.value)}
                        placeholder="Minutes"
                        className="
                          min-h-[44px] flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2
                          text-base text-gray-900 placeholder:text-gray-400
                          focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2
                          focus:ring-blue-500/40
                          dark:border-gray-600 dark:bg-gray-700/60 dark:text-white
                          dark:placeholder:text-gray-500 dark:focus:bg-gray-700
                        "
                      />
                      <Button
                        variant="primary"
                        size="md"
                        disabled={!customBreakMinutes || isNaN(parseInt(customBreakMinutes))}
                        onClick={() => {
                          const minutes = parseInt(customBreakMinutes)
                          if (!isNaN(minutes) && minutes >= 0) {
                            handleBreakSelected(minutes)
                          }
                        }}
                      >
                        Use
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    onClick={() => handleBreakSelected(null)}
                  >
                    No break
                  </Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

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
