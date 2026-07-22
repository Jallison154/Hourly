import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
    if (isClockingOut) return

    if (minutes != null) {
      if (!Number.isFinite(minutes) || minutes < 0 || !Number.isInteger(minutes)) {
        await showAlert('Invalid break', 'Enter break time as whole minutes (for example 90 for 1 hour 30 minutes).')
        return
      }
      if (minutes > 24 * 60) {
        await showAlert('Invalid break', 'Break cannot be more than 24 hours.')
        return
      }
    }

    setShowBreakDialog(false)
    setIsClockingOut(true)
    try {
      const time = useCustomTime ? clockOutTime.toISOString() : undefined
      // Use nullish coalescing so 0 minutes is sent correctly
      await timeEntriesAPI.clockOut(time, minutes ?? undefined)
      await loadStatus()
      setUseCustomTime(false)
      setShowTimePicker(false)
      setCustomBreakMinutes('')
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string | unknown }; status?: number } }
      const raw = axiosError.response?.data?.error
      const message =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw)
            ? 'Invalid break or clock-out time. Please try again.'
            : axiosError.response?.status === 500
              ? 'Server error. Please try again.'
              : 'Failed to clock out. Please try again.'
      await showAlert('Error', message)
      setShowBreakDialog(true)
    } finally {
      setIsClockingOut(false)
    }
  }

  const applyCustomBreakMinutes = () => {
    const minutes = Number.parseInt(String(customBreakMinutes).trim(), 10)
    if (!customBreakMinutes.trim() || Number.isNaN(minutes) || minutes < 0) {
      void showAlert('Invalid break', 'Enter break time as whole minutes (for example 90 for 1 hour 30 minutes).')
      return
    }
    void handleBreakSelected(minutes)
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
      <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 page-with-nav">
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
            <div className="mb-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => {
                  setShowTimePicker(!showTimePicker)
                  setUseCustomTime(!showTimePicker)
                }}
              >
                {showTimePicker ? 'Use current time' : 'Custom in time'}
              </Button>
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
            <div className="mb-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => {
                  setShowTimePicker(!showTimePicker)
                  setUseCustomTime(!showTimePicker)
                }}
              >
                {showTimePicker ? 'Use current time' : 'Custom out time'}
              </Button>
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

      {/* Break Selection Sheet — portaled so fixed centering uses the viewport */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showBreakDialog && (
              <div className="fixed inset-0 z-[100] grid place-items-center p-4">
                <motion.button
                  type="button"
                  aria-label="Close"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowBreakDialog(false)}
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="break-sheet-title"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                  className="
                    relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col
                    rounded-2xl bg-white shadow-2xl
                    dark:bg-gray-800
                  "
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex-1 overflow-y-auto px-5 py-6">
                    <h2
                      id="break-sheet-title"
                      className="mb-1 text-xl font-bold text-gray-900 dark:text-white"
                    >
                      Did you take a break today?
                    </h2>
                    <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
                      Pick a duration to subtract from your shift.
                    </p>

                    <div className="mb-4 grid grid-cols-3 gap-2">
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

                    <div className="mb-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Custom minutes
                      </label>
                      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                        Example: 90 = 1 hour 30 minutes
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={24 * 60}
                          step={1}
                          value={customBreakMinutes}
                          onChange={(e) => setCustomBreakMinutes(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              applyCustomBreakMinutes()
                            }
                          }}
                          placeholder="e.g. 90"
                          className="
                            min-h-[44px] w-full flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2
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
                          disabled={!String(customBreakMinutes).trim() || Number.isNaN(Number.parseInt(String(customBreakMinutes).trim(), 10))}
                          onClick={applyCustomBreakMinutes}
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
            )}
          </AnimatePresence>,
          document.body
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
