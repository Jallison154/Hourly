import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { timesheetAPI, timeEntriesAPI } from '../services/api'
import { formatDate, formatTime, formatHours, formatCurrency } from '../utils/date'
import { formatTimesheetAsText } from '../utils/timesheetFormatter'
import Dialog from '../components/Dialog'
import { useDialog } from '../hooks/useDialog'
import type { TimesheetData } from '../types'
import { TrashIcon } from '@heroicons/react/24/outline'

export default function Timesheet() {
  const [timesheet, setTimesheet] = useState<TimesheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [payPeriods, setPayPeriods] = useState<Array<{ start: string; end: string }>>([])
  const [selectedPeriod, setSelectedPeriod] = useState<{ start: string; end: string } | null>(null)
  const [isClockedIn, setIsClockedIn] = useState(false)
  const { dialog, showAlert, showConfirm, closeDialog } = useDialog()

  useEffect(() => {
    const initialize = async () => {
      try {
        const periods = await timesheetAPI.getPayPeriods()
        setPayPeriods(periods)
        if (periods.length > 0) {
          setSelectedPeriod(periods[0])
          // Load timesheet for first period
          await loadTimesheet(periods[0].start, periods[0].end)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to load pay periods:', error)
        setLoading(false)
      }
    }
    initialize()
  }, [])

  useEffect(() => {
    if (selectedPeriod && payPeriods.length > 0) {
      loadTimesheet(selectedPeriod.start, selectedPeriod.end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod])

  // Check clock status periodically and refresh timesheet if clocked in
  useEffect(() => {
    const checkClockStatus = async () => {
      try {
        const status = await timeEntriesAPI.getStatus()
        const wasClockedIn = isClockedIn
        setIsClockedIn(status.isClockedIn)
        
        // If we just clocked in and are viewing current period, refresh immediately
        if (status.isClockedIn && !wasClockedIn && selectedPeriod && payPeriods.length > 0) {
          const isCurrentPeriod = payPeriods[0] && 
            selectedPeriod.start === payPeriods[0].start && 
            selectedPeriod.end === payPeriods[0].end
          if (isCurrentPeriod) {
            loadTimesheet(selectedPeriod.start, selectedPeriod.end, true)
          }
        }
      } catch (error) {
        console.error('Failed to check clock status:', error)
      }
    }

    // Check immediately
    checkClockStatus()

    // Check every 3 seconds to detect clock in/out changes quickly
    const interval = setInterval(checkClockStatus, 3000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClockedIn, selectedPeriod, payPeriods])

  // Auto-refresh timesheet when clocked in and viewing current period
  useEffect(() => {
    if (!isClockedIn || !selectedPeriod || payPeriods.length === 0) {
      return
    }

    // Only auto-refresh if viewing the current pay period (first period)
    const isCurrentPeriod = payPeriods[0] && 
      selectedPeriod.start === payPeriods[0].start && 
      selectedPeriod.end === payPeriods[0].end

    if (!isCurrentPeriod) {
      return
    }

    // Refresh timesheet every 2 seconds when clocked in (silent refresh - no loading state)
    // This allows you to see your pay increase in real-time
    const refreshInterval = setInterval(() => {
      loadTimesheet(selectedPeriod.start, selectedPeriod.end, true) // silent = true to avoid loading state
    }, 2000)

    return () => clearInterval(refreshInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClockedIn, selectedPeriod?.start, selectedPeriod?.end, payPeriods.length])

  const loadTimesheet = async (startDate?: string, endDate?: string, silent = false) => {
    if (!silent) {
      setLoading(true)
    }
    try {
      const data = await timesheetAPI.getTimesheet(startDate, endDate)
      setTimesheet(data)
    } catch (error: any) {
      console.error('Failed to load timesheet:', error)
      console.error('Error details:', error.response?.data || error.message)
      // Don't set loading to false on error so user sees the error state
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    const confirmed = await showConfirm(
      'Delete Time Entry',
      'Are you sure you want to delete this time entry? This action cannot be undone.',
      'Delete',
      'Cancel'
    )

    if (!confirmed) return

    try {
      await timeEntriesAPI.deleteEntry(entryId)
      // Reload the timesheet for the current period
      if (selectedPeriod) {
        await loadTimesheet(selectedPeriod.start, selectedPeriod.end)
      }
    } catch (error: any) {
      await showAlert('Error', error.response?.data?.error || 'Failed to delete entry')
    }
  }

  const handleCopyToClipboard = async () => {
    if (!timesheet) return
    
    try {
      const text = formatTimesheetAsText(timesheet)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      await showAlert('Error', 'Failed to copy to clipboard')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!timesheet && !loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-2">Failed to load timesheet</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Please check the browser console for details
          </div>
        </div>
      </div>
    )
  }

  // Type guard: timesheet is guaranteed to be non-null after early returns
  if (!timesheet) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 sm:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Timesheet
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pay Period
                </label>
                <select
                  value={selectedPeriod ? `${selectedPeriod.start}|${selectedPeriod.end}` : ''}
                  onChange={(e) => {
                    const [start, end] = e.target.value.split('|')
                    if (start && end) {
                      setSelectedPeriod({ start, end })
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[250px]"
                >
                  {payPeriods.map((period, index) => {
                    const startDate = new Date(period.start)
                    const endDate = new Date(period.end)
                    const isCurrent = index === 0
                    return (
                      <option key={`${period.start}|${period.end}`} value={`${period.start}|${period.end}`}>
                        {formatDate(startDate)} - {formatDate(endDate)} {isCurrent ? '(Current)' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Hourly Rate: {formatCurrency(timesheet.user.hourlyRate)}/hr
                </p>
              </div>
            </div>
          </div>
          <motion.button
            onClick={handleCopyToClipboard}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <span>✓ Copied!</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>Copy as Text</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Weekly Breakdown */}
        {timesheet.weeks.map((week, weekIndex) => (
            <motion.div
              key={week.weekNumber}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: weekIndex * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Week {week.weekNumber}
                </h2>
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Hours</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatHours(week.totalHours)}
                  </div>
                </div>
              </div>

              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(week.start)} - {formatDate(week.end)}
              </div>

              {/* Week Entries */}
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Clock In
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Clock Out
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Hours
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Breaks
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {week.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatDate(entry.clockIn)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatTime(entry.clockIn)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {entry.clockOut ? formatTime(entry.clockOut) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                          {formatHours(entry.hours)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {entry.breaks.length > 0 ? (
                            <div>
                              {entry.breaks.map((b) => (
                                <div key={b.id} className="text-xs">
                                  {b.breakType}: {b.duration || 0}m
                                </div>
                              ))}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                            title="Delete entry"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Week Pay Summary */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="mb-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Hours Breakdown</div>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Regular: </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatHours(week.pay.regularHours)}
                      </span>
                    </div>
                    {week.pay.overtimeHours > 0 && (
                      <div>
                        <span className="text-orange-600 dark:text-orange-400">Overtime: </span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">
                          {formatHours(week.pay.overtimeHours)} (1.5x)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">Regular Pay</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(week.pay.regularPay)}
                    </div>
                  </div>
                  {week.pay.overtimePay > 0 && (
                    <div className="border-l-4 border-orange-500 pl-3">
                      <div className="text-orange-600 dark:text-orange-400 font-medium">Overtime Pay</div>
                      <div className="font-semibold text-orange-600 dark:text-orange-400">
                        {formatCurrency(week.pay.overtimePay)}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">Gross Pay</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(week.pay.grossPay)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">Net Pay</div>
                    <div className="font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(week.pay.netPay)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
        ))}

        {/* Pay Period Totals */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: timesheet.weeks.length * 0.1 }}
            className="bg-blue-600 dark:bg-blue-700 rounded-lg shadow-lg p-6 text-white"
          >
              <h2 className="text-2xl font-bold mb-4">Pay Period Totals</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-blue-100 text-sm mb-1">Total Hours</div>
                  <div className="text-2xl font-bold">{formatHours(timesheet.totals.totalHours)}</div>
                </div>
                <div>
                  <div className="text-blue-100 text-sm mb-1">Gross Pay</div>
                  <div className="text-2xl font-bold">{formatCurrency(timesheet.totals.grossPay)}</div>
                </div>
                <div>
                  <div className="text-blue-100 text-sm mb-1">Total Taxes</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      timesheet.totals.federalTax + timesheet.totals.stateTax + timesheet.totals.fica
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-blue-100 text-sm mb-1">Net Pay</div>
                  <div className="text-3xl font-bold">{formatCurrency(timesheet.totals.netPay)}</div>
                </div>
            </div>
          </motion.div>
      </motion.div>

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

