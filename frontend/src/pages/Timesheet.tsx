import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { timesheetAPI, timeEntriesAPI, paycheckAPI } from '../services/api'
import { formatDate, formatDateWithDay, formatTime, formatHours, formatCurrency } from '../utils/date'
import { formatTimesheetAsText } from '../utils/timesheetFormatter'
import Dialog from '../components/Dialog'
import { useDialog } from '../hooks/useDialog'
import TimePicker from '../components/TimePicker'
import type { TimesheetData, Break } from '../types'
import { TrashIcon, PencilIcon, PlusIcon, EnvelopeIcon, Bars3Icon } from '@heroicons/react/24/outline'

export default function Timesheet() {
  const [timesheet, setTimesheet] = useState<TimesheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [payPeriods, setPayPeriods] = useState<Array<{ start: string; end: string }>>([])
  const [selectedPeriod, setSelectedPeriod] = useState<{ start: string; end: string } | null>(null)
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [editingEntry, setEditingEntry] = useState<{ id: string; clockIn: string; clockOut: string | null; notes?: string | null; breaks?: Array<{ id: string; breakType: string; startTime: string; endTime: string | null; duration: number | null; notes: string | null }> } | null>(null)
  const [creatingEntry, setCreatingEntry] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  
  // Pay Summary state
  const [calculation, setCalculation] = useState<any>(null)
  
  const { dialog, showAlert, showConfirm, closeDialog } = useDialog()
  // Use ref to track previous clock status for transition detection
  const prevClockedInRef = useRef<boolean>(false)

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
        const wasClockedIn = prevClockedInRef.current
        const isNowClockedIn = status.isClockedIn
        
        // Update ref before state to capture transition
        prevClockedInRef.current = isNowClockedIn
        setIsClockedIn(isNowClockedIn)
        
        // If we just clocked in and are viewing current period, refresh immediately
        if (isNowClockedIn && !wasClockedIn && selectedPeriod && payPeriods.length > 0) {
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
  }, [selectedPeriod, payPeriods])

  // Auto-refresh timesheet when clocked in and viewing current period
  useEffect(() => {
    if (!isClockedIn || !selectedPeriod || payPeriods.length === 0) {
      return
    }

    // Only auto-refresh if viewing the current pay period (first period)
    const currentPeriod = payPeriods[0]
    const isCurrentPeriod = currentPeriod && 
      selectedPeriod.start === currentPeriod.start && 
      selectedPeriod.end === currentPeriod.end

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
  }, [isClockedIn, selectedPeriod?.start, selectedPeriod?.end, payPeriods])

  const loadTimesheet = async (startDate?: string, endDate?: string, silent = false) => {
    if (!silent) {
      setLoading(true)
    }
    try {
      const data = await timesheetAPI.getTimesheet(startDate, endDate)
      setTimesheet(data)
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string }
      console.error('Failed to load timesheet:', error)
      console.error('Error details:', axiosError.response?.data || axiosError.message)
      // Show error to user
      showAlert('Failed to load timesheet', axiosError.response?.data?.message || axiosError.message || 'An error occurred')
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const handleEditEntry = async (entry: { id: string; clockIn: string; clockOut: string | null; notes?: string | null }) => {
    try {
      // Fetch full entry with breaks
      const fullEntry = await timeEntriesAPI.getEntry(entry.id)
      setEditingEntry({
        id: fullEntry.id,
        clockIn: fullEntry.clockIn,
        clockOut: fullEntry.clockOut,
        notes: fullEntry.notes || null,
        breaks: fullEntry.breaks || []
      })
    } catch (error) {
      // Fallback to basic entry if fetch fails
    setEditingEntry(entry)
    }
  }

  const handleCreateEntry = () => {
    // Set default times for new entry (today, current time)
    const now = new Date()
    const defaultClockOut = new Date(now)
    defaultClockOut.setHours(defaultClockOut.getHours() + 8) // Default 8 hour shift
    
    setCreatingEntry(true)
    setEditingEntry({
      id: 'new',
      clockIn: now.toISOString(),
      clockOut: defaultClockOut.toISOString(),
      notes: null
    })
  }

  const handleSaveEdit = async (updates: { clockIn: string; clockOut: string | null; notes?: string | null }) => {
    if (!editingEntry) return

    try {
      if (editingEntry.id === 'new') {
        // Create new entry
        await timeEntriesAPI.createEntry({
          clockIn: updates.clockIn,
          clockOut: updates.clockOut || undefined,
          notes: updates.notes || undefined,
          isManualEntry: true
        })
        setCreatingEntry(false)
      } else {
        // Update existing entry
        await timeEntriesAPI.updateEntry(editingEntry.id, {
          clockIn: updates.clockIn,
          clockOut: updates.clockOut,
          notes: updates.notes || null
        })
      }
      setEditingEntry(null)
      // Reload data
      if (selectedPeriod) {
        await loadTimesheet(selectedPeriod.start, selectedPeriod.end)
        await loadPaycheckCalculation(selectedPeriod.start, selectedPeriod.end)
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      await showAlert('Error', axiosError.response?.data?.error || 'Failed to save entry')
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
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      await showAlert('Error', axiosError.response?.data?.error || 'Failed to delete entry')
    }
  }

  const handleCopyToClipboard = async () => {
    if (!timesheet) return
    
    try {
      const text = formatTimesheetAsText(timesheet)
      
      // Try modern clipboard API first (with proper undefined checks)
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
          return
        } catch (clipboardError) {
          console.warn('Clipboard API failed, trying fallback:', clipboardError)
          // Continue to fallback
        }
      }
      
      // Fallback for older browsers or when clipboard API isn't available
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      try {
        const successful = document.execCommand('copy')
        if (successful) {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } else {
          throw new Error('execCommand copy failed')
        }
      } catch (execError) {
        console.error('Fallback copy method failed:', execError)
        throw execError
      } finally {
        document.body.removeChild(textArea)
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      await showAlert('Error', 'Failed to copy to clipboard. Please ensure you have clipboard permissions enabled.')
    }
  }

  const handleEmailTimesheet = () => {
    if (!timesheet || !selectedPeriod) return
    
    const text = formatTimesheetAsText(timesheet)
    
    // Get the months from the pay period for the subject
    const startDate = new Date(selectedPeriod.start)
    const endDate = new Date(selectedPeriod.end)
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    let subject = ''
    if (startMonth === endMonth) {
      subject = `${startMonth} Timesheet`
    } else {
      subject = `${startMonth} - ${endMonth} Timesheet`
    }
    
    // Encode the email body and subject
    const encodedSubject = encodeURIComponent(subject)
    const encodedBody = encodeURIComponent(text)
    
    // Create mailto link
    const mailtoLink = `mailto:?subject=${encodedSubject}&body=${encodedBody}`
    
    // Open email client
    window.location.href = mailtoLink
  }

  // Load paycheck calculation when timesheet loads
  const loadPaycheckCalculation = async (startDate?: string, endDate?: string) => {
    try {
      const data = await paycheckAPI.getEstimate(startDate, endDate)
      setCalculation(data)
    } catch (error) {
      console.error('Failed to load paycheck calculation:', error)
      // Don't show error to user, just log it
    }
  }

  // Load paycheck calculation when period changes
  useEffect(() => {
    if (selectedPeriod) {
      loadPaycheckCalculation(selectedPeriod.start, selectedPeriod.end)
    }
  }, [selectedPeriod])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:pb-8" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-600 dark:text-gray-400">Loading...</div>
          </div>
        ) : !timesheet ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-red-600 dark:text-red-400 mb-2">Failed to load timesheet</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Please check the browser console for details
              </div>
            </div>
          </div>
        ) : (
          <>
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Timesheet
              </h1>
              {/* Hamburger Menu Button */}
              <div className="relative">
                <motion.button
                  onClick={() => setShowMenu(!showMenu)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                  aria-label="Menu"
                >
                  <Bars3Icon className="h-6 w-6" />
                </motion.button>
                
                {/* Dropdown Menu */}
                {showMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1"
                    >
                      <button
                        onClick={() => {
                          handleCreateEntry()
                          setShowMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <PlusIcon className="h-5 w-5" />
                        <span>Add Entry</span>
                      </button>
                      <button
                        onClick={async () => {
                          await handleCopyToClipboard()
                          setShowMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <span>📋</span>
                        <span>{copied ? 'Copied!' : 'Copy as Text'}</span>
                      </button>
                      <button
                        onClick={() => {
                          handleEmailTimesheet()
                          setShowMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <EnvelopeIcon className="h-5 w-5" />
                        <span>Email</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </div>
            </div>
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
                        Daily Pay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {week.entries.map((entry, entryIndex) => {
                      // Calculate cumulative hours up to this entry
                      // Include hours from previous pay period entries in this week
                      const previousHours = week.previousPayPeriodHours || 0
                      const cumulativeHoursFromDisplayed = week.entries
                        .slice(0, entryIndex + 1)
                        .reduce((sum, e) => sum + (e.hours || 0), 0)
                      const cumulativeHours = previousHours + cumulativeHoursFromDisplayed
                      
                      // Entry is in overtime if week total exceeds 40 AND cumulative hours exceed 40
                      const isOvertime = week.totalHours > 40 && cumulativeHours > 40
                      
                      // Calculate how much of this entry is overtime
                      const regularHoursInEntry = isOvertime 
                        ? Math.max(0, 40 - (cumulativeHours - entry.hours))
                        : entry.hours
                      const overtimeHoursInEntry = isOvertime
                        ? entry.hours - regularHoursInEntry
                        : 0
                      
                      const rowClass = isOvertime 
                        ? 'bg-red-50 dark:bg-red-900/20' 
                        : ''
                      
                      return (
                        <tr key={entry.id} className={rowClass}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div>{formatDateWithDay(entry.clockIn)}</div>
                        </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatTime(entry.clockIn)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {entry.clockOut ? formatTime(entry.clockOut) : '-'}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${isOvertime ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            {formatHours(entry.hours)}
                            {isOvertime && overtimeHoursInEntry > 0 && (
                              <span className="text-xs ml-1 text-red-500 dark:text-red-400">
                                ({formatHours(regularHoursInEntry)} reg + {formatHours(overtimeHoursInEntry)} OT)
                              </span>
                            )}
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
                          <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${isOvertime ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {entry.clockOut
                              ? (() => {
                                  // Calculate actual pay for this entry based on regular and overtime hours
                                  const hourlyRate = timesheet.user.hourlyRate
                                  const overtimeRate = timesheet.user.overtimeRate || 1.5
                                  const entryPay = (regularHoursInEntry * hourlyRate) + (overtimeHoursInEntry * hourlyRate * overtimeRate)
                                  return formatCurrency(entryPay)
                                })()
                              : '-'}
                          </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-3">
                            <motion.button
                              onClick={() => handleEditEntry({
                                id: entry.id,
                                clockIn: entry.clockIn,
                                clockOut: entry.clockOut,
                                notes: entry.notes || null
                              })}
                              whileTap={{ scale: 0.97, opacity: 0.8 }}
                              transition={{ duration: 0.1 }}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="Edit entry"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </motion.button>
                            <motion.button
                              onClick={() => handleDeleteEntry(entry.id)}
                              whileTap={{ scale: 0.97, opacity: 0.8 }}
                              transition={{ duration: 0.1 }}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Delete entry"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </motion.button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                    </tbody>
                </table>
              </div>

              {/* Week Pay Summary */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                {(() => {
                  // Use backend-calculated values from week.pay
                  const weekPay = week.pay
                  const totalGrossPay = weekPay.grossPay
                  const totalNetPay = weekPay.netPay
                  const totalRegularHours = weekPay.regularHours
                  const totalOvertimeHours = weekPay.overtimeHours
                  const totalRegularPay = weekPay.regularPay
                  const totalOvertimePay = weekPay.overtimePay
                  
                  return (
                    <>
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Hours Breakdown</div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Regular: </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatHours(totalRegularHours)}
                            </span>
                          </div>
                          {totalOvertimeHours > 0 && (
                            <div>
                              <span className="text-orange-600 dark:text-orange-400">Overtime: </span>
                              <span className="font-semibold text-orange-600 dark:text-orange-400">
                                {formatHours(totalOvertimeHours)} (1.5x)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Regular Pay</div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(totalRegularPay)}
                          </div>
                        </div>
                        {totalOvertimePay > 0 && (
                          <div className="border-l-4 border-orange-500 pl-3">
                            <div className="text-orange-600 dark:text-orange-400 font-medium">Overtime Pay</div>
                            <div className="font-semibold text-orange-600 dark:text-orange-400">
                              {formatCurrency(totalOvertimePay)}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Gross Pay</div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(totalGrossPay)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Net Pay</div>
                          <div className="font-semibold text-blue-600 dark:text-blue-400">
                            {formatCurrency(totalNetPay)}
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}
            </div>
          </motion.div>
        ))}

        {/* Pay Summary */}
        {calculation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: timesheet.weeks.length * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Pay Summary
              </h2>
              {calculation.payPeriod && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(calculation.payPeriod.start)} - {formatDate(calculation.payPeriod.end)}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Regular Hours</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatHours(calculation.regularHours)}
                </div>
              </div>
              {calculation.overtimeHours > 0 && (
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overtime Hours</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatHours(calculation.overtimeHours)}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gross Pay</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(calculation.grossPay)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Pay</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(calculation.netPay)}
                </div>
              </div>
            </div>

            {/* Tax Breakdown */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Tax Breakdown
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Federal Tax</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(calculation.federalTax)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Montana State Tax {calculation.stateTaxRate ? `(${(calculation.stateTaxRate * 100).toFixed(2)}%)` : '(Progressive: 4.7% up to $21,100, 5.9% above)'}
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(calculation.stateTax)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">FICA (Social Security + Medicare)</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(calculation.fica)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span className="text-gray-900 dark:text-white">Total Taxes</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(
                      calculation.federalTax + calculation.stateTax + calculation.fica
                    )}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
          </>
        )}
      </motion.div>

      {/* Edit/Create Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {creatingEntry ? 'Add Time Entry' : 'Edit Time Entry'}
            </h2>
            <EditEntryForm
              entry={editingEntry}
              isCreating={creatingEntry}
              onSave={handleSaveEdit}
              onCancel={() => {
                setEditingEntry(null)
                setCreatingEntry(false)
              }}
            />
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
  )
}

// Edit Entry Form Component
function EditEntryForm({ 
  entry, 
  isCreating = false,
  onSave, 
  onCancel 
}: { 
  entry: { id: string; clockIn: string; clockOut: string | null; notes?: string | null; breaks?: Array<{ id: string; breakType: string; startTime: string; endTime: string | null; duration: number | null; notes: string | null }> }
  isCreating?: boolean
  onSave: (updates: { clockIn: string; clockOut: string | null; notes?: string | null }) => void
  onCancel: () => void
}) {
  const [clockIn, setClockIn] = useState(() => new Date(entry.clockIn))
  const [clockOut, setClockOut] = useState(() => {
    if (entry.clockOut) {
      return new Date(entry.clockOut)
    }
    // Default to 1 hour after clock in if no clock out
    const defaultOut = new Date(entry.clockIn)
    defaultOut.setHours(defaultOut.getHours() + 1)
    return defaultOut
  })
  const [hasClockOut, setHasClockOut] = useState(!!entry.clockOut)
  const [notes, setNotes] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [breaks, setBreaks] = useState<Break[]>(() => {
    // Ensure breaks match the Break type structure
    if (!entry.breaks) return []
    return entry.breaks.map(breakItem => ({
      id: breakItem.id,
      timeEntryId: entry.id,
      breakType: breakItem.breakType as 'lunch' | 'rest' | 'other',
      startTime: breakItem.startTime,
      endTime: breakItem.endTime,
      duration: breakItem.duration,
      notes: breakItem.notes,
      createdAt: (breakItem as any).createdAt || new Date().toISOString(),
      updatedAt: (breakItem as any).updatedAt || new Date().toISOString()
    }))
  })
  const [showAddBreak, setShowAddBreak] = useState(false)
  const [newBreak, setNewBreak] = useState({
    breakType: 'lunch' as 'lunch' | 'rest' | 'other',
    startTime: new Date(),
    endTime: new Date(),
    hasEndTime: true,
    duration: 30,
    notes: ''
  })
  const [loadingBreaks, setLoadingBreaks] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      // Validate clock out is after clock in
      if (hasClockOut && clockOut <= clockIn) {
        setError('Clock out time must be after clock in time')
        setSaving(false)
        return
      }

      await onSave({
        clockIn: clockIn.toISOString(),
        clockOut: hasClockOut ? clockOut.toISOString() : null,
        notes: notes || null
      })
      
      // Reload breaks after save to ensure we have latest data
      if (entry.id !== 'new') {
        try {
          const updatedEntry = await timeEntriesAPI.getEntry(entry.id)
          setBreaks(updatedEntry.breaks || [])
        } catch (err) {
          console.error('Failed to reload breaks:', err)
        }
      }
    } catch (error) {
      console.error('Error saving entry:', error)
      setError('Failed to save entry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded">
          {error}
        </div>
      )}

      <TimePicker
        value={clockIn}
        onChange={setClockIn}
        label="Clock In"
      />

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="hasClockOut"
          checked={hasClockOut}
          onChange={(e) => setHasClockOut(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
        <label htmlFor="hasClockOut" className="text-sm text-gray-700 dark:text-gray-300">
          Has clock out time
        </label>
      </div>

      {hasClockOut && (
        <TimePicker
          value={clockOut}
          onChange={setClockOut}
          label="Clock Out"
        />
      )}

      {/* Break Management */}
      {entry.id !== 'new' && (
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Breaks
            </label>
            <motion.button
              type="button"
              onClick={() => setShowAddBreak(!showAddBreak)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
            >
              + Add Break
            </motion.button>
          </div>

          {breaks.length > 0 && (
            <div className="space-y-2 mb-3">
              {breaks.map((b) => (
                <div
                  key={b.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex justify-between items-center"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white capitalize text-sm">
                      {b.breakType}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {formatTime(b.startTime)}
                      {b.endTime && ` - ${formatTime(b.endTime)}`}
                      {b.duration !== null && b.duration !== undefined && ` (${b.duration}m)`}
                    </div>
                    {b.notes && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{b.notes}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setLoadingBreaks(true)
                        await timeEntriesAPI.deleteBreak(b.id)
                        setBreaks(breaks.filter(br => br.id !== b.id))
                      } catch (err: unknown) {
                        const axiosError = err as { response?: { data?: { error?: string } } }
                        setError(axiosError.response?.data?.error || 'Failed to delete break')
                      } finally {
                        setLoadingBreaks(false)
                      }
                    }}
                    disabled={loadingBreaks}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          <AnimatePresence>
            {showAddBreak && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Break Type
                  </label>
                  <select
                    value={newBreak.breakType}
                    onChange={(e) => setNewBreak({ ...newBreak, breakType: e.target.value as 'lunch' | 'rest' | 'other' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-sm"
                  >
                    <option value="lunch">Lunch</option>
                    <option value="rest">Rest Break</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time
                    </label>
                    <TimePicker
                      value={newBreak.startTime}
                      onChange={(date) => setNewBreak({ ...newBreak, startTime: date })}
                      label=""
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newBreak.duration}
                      onChange={(e) => setNewBreak({ ...newBreak, duration: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={newBreak.notes}
                    onChange={(e) => setNewBreak({ ...newBreak, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-sm"
                    placeholder="Break notes..."
                  />
                </div>

                <div className="flex gap-2">
                  <motion.button
                    type="button"
                    onClick={async () => {
                      try {
                        setLoadingBreaks(true)
                        const endTime = new Date(newBreak.startTime)
                        endTime.setMinutes(endTime.getMinutes() + newBreak.duration)
                        const addedBreak = await timeEntriesAPI.addBreak(entry.id, {
                          breakType: newBreak.breakType,
                          startTime: newBreak.startTime.toISOString(),
                          endTime: endTime.toISOString(),
                          duration: newBreak.duration,
                          notes: newBreak.notes || undefined
                        })
                        setBreaks([...breaks, addedBreak])
                        setNewBreak({
                          breakType: 'lunch',
                          startTime: new Date(),
                          endTime: new Date(),
                          hasEndTime: true,
                          duration: 30,
                          notes: ''
                        })
                        setShowAddBreak(false)
                      } catch (err: unknown) {
                        const axiosError = err as { response?: { data?: { error?: string } } }
                        setError(axiosError.response?.data?.error || 'Failed to add break')
                      } finally {
                        setLoadingBreaks(false)
                      }
                    }}
                    disabled={loadingBreaks}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    Add Break
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => {
                      setShowAddBreak(false)
                      setNewBreak({
                        breakType: 'lunch',
                        startTime: new Date(),
                        endTime: new Date(),
                        hasEndTime: true,
                        duration: 30,
                        notes: ''
                      })
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          placeholder="Add any notes about this entry..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : isCreating ? 'Create Entry' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

