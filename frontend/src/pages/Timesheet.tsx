import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { timesheetAPI, timeEntriesAPI } from '../services/api'
import { formatDate, formatDateWithDay, formatTime, formatHours, formatCurrency } from '../utils/date'
import { formatTimesheetAsText } from '../utils/timesheetFormatter'
import Dialog from '../components/Dialog'
import { useDialog } from '../hooks/useDialog'
import TimePicker from '../components/TimePicker'
import type { TimesheetData } from '../types'
import { TrashIcon, PencilIcon, PlusIcon } from '@heroicons/react/24/outline'

export default function Timesheet() {
  const [timesheet, setTimesheet] = useState<TimesheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [payPeriods, setPayPeriods] = useState<Array<{ start: string; end: string }>>([])
  const [selectedPeriod, setSelectedPeriod] = useState<{ start: string; end: string } | null>(null)
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [editingEntry, setEditingEntry] = useState<{ id: string; clockIn: string; clockOut: string | null; notes?: string | null } | null>(null)
  const [creatingEntry, setCreatingEntry] = useState(false)
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

  const handleEditEntry = (entry: { id: string; clockIn: string; clockOut: string | null; notes?: string | null }) => {
    setEditingEntry(entry)
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
      // Reload the timesheet for the current period
      if (selectedPeriod) {
        await loadTimesheet(selectedPeriod.start, selectedPeriod.end)
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:pb-8" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Timesheet
              </h1>
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
          <div className="flex items-center gap-3">
            <motion.button
              onClick={handleCreateEntry}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97, opacity: 0.9 }}
              transition={{ duration: 0.1 }}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Add Entry</span>
            </motion.button>
            <motion.button
              onClick={handleCopyToClipboard}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97, opacity: 0.9 }}
              transition={{ duration: 0.1 }}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-colors"
            >
              {copied ? (
                <>
                  <span>✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy as Text</span>
                </>
              )}
            </motion.button>
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
                  // Calculate totals by summing individual entry pays to match daily pay column
                  const hourlyRate = timesheet.user.hourlyRate
                  const overtimeRate = timesheet.user.overtimeRate || 1.5
                  const previousHours = week.previousPayPeriodHours || 0
                  
                  let totalRegularHours = 0
                  let totalOvertimeHours = 0
                  let totalRegularPay = 0
                  let totalOvertimePay = 0
                  
                  // Calculate full week hours for overtime determination
                  const fullWeekHours = week.totalHours + previousHours
                  
                  week.entries.forEach((entry, entryIndex) => {
                    if (!entry.clockOut) return
                    
                    const cumulativeHoursFromDisplayed = week.entries
                      .slice(0, entryIndex + 1)
                      .reduce((sum, e) => sum + (e.hours || 0), 0)
                    const cumulativeHours = previousHours + cumulativeHoursFromDisplayed
                    
                    const isOvertime = fullWeekHours > 40 && cumulativeHours > 40
                    const regularHoursInEntry = isOvertime 
                      ? Math.max(0, 40 - (cumulativeHours - entry.hours))
                      : entry.hours
                    const overtimeHoursInEntry = isOvertime
                      ? entry.hours - regularHoursInEntry
                      : 0
                    
                    totalRegularHours += regularHoursInEntry
                    totalOvertimeHours += overtimeHoursInEntry
                    totalRegularPay += regularHoursInEntry * hourlyRate
                    totalOvertimePay += overtimeHoursInEntry * hourlyRate * overtimeRate
                  })
                  
                  const totalGrossPay = totalRegularPay + totalOvertimePay
                  
                  // Calculate taxes (same logic as backend - 2024 brackets)
                  const annualGrossPay = totalGrossPay * 24 // Estimate annual (monthly pay periods)
                  
                  // Federal tax brackets (2024, Single filer)
                  const federalBrackets = [
                    { min: 0, max: 11600, rate: 0.10 },
                    { min: 11600, max: 47150, rate: 0.12 },
                    { min: 47150, max: 100525, rate: 0.22 },
                    { min: 100525, max: 191950, rate: 0.24 },
                    { min: 191950, max: 243725, rate: 0.32 },
                    { min: 243725, max: 609350, rate: 0.35 },
                    { min: 609350, max: Infinity, rate: 0.37 }
                  ]
                  
                  let annualFederalTax = 0
                  let remainingIncome = annualGrossPay
                  
                  for (const bracket of federalBrackets) {
                    if (remainingIncome <= 0) break
                    const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min)
                    annualFederalTax += taxableInBracket * bracket.rate
                    remainingIncome -= taxableInBracket
                  }
                  
                  // State tax
                  const stateTaxRate = week.pay.stateTaxRate || 0.059 // Default Montana rate
                  const annualStateTax = annualGrossPay * stateTaxRate
                  
                  // FICA (Social Security + Medicare)
                  const socialSecurityWageBase = 168600
                  const socialSecurityRate = 0.062
                  const medicareRate = 0.0145
                  const additionalMedicareThreshold = 200000
                  const additionalMedicareRate = 0.009
                  
                  const socialSecurityIncome = Math.min(annualGrossPay, socialSecurityWageBase)
                  const annualFICA = socialSecurityIncome * socialSecurityRate
                  const annualMedicare = annualGrossPay * medicareRate
                  const additionalMedicare = annualGrossPay > additionalMedicareThreshold 
                    ? (annualGrossPay - additionalMedicareThreshold) * additionalMedicareRate 
                    : 0
                  const totalAnnualFICA = annualFICA + annualMedicare + additionalMedicare
                  
                  // Pro-rate to pay period
                  const federalTax = (annualFederalTax / annualGrossPay) * totalGrossPay
                  const stateTax = (annualStateTax / annualGrossPay) * totalGrossPay
                  const fica = (totalAnnualFICA / annualGrossPay) * totalGrossPay
                  
                  const totalNetPay = totalGrossPay - federalTax - stateTax - fica
                  
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
  entry: { id: string; clockIn: string; clockOut: string | null; notes?: string | null }
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

