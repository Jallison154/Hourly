import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { paycheckAPI, userAPI, timesheetAPI, timeEntriesAPI } from '../services/api'
import Dialog from '../components/Dialog'
import { useDialog } from '../hooks/useDialog'
import { formatCurrency, formatHours, formatDate, formatTime, formatDateWithDay } from '../utils/date'
import TimePicker from '../components/TimePicker'
import type { PayCalculation, Break } from '../types'

export default function PaycheckCalculator() {
  const [hourlyRate, setHourlyRate] = useState(0)
  const [hours, setHours] = useState('')
  const [calculation, setCalculation] = useState<PayCalculation & {
    hourlyRate?: number
    weeklyBreakdown?: Array<PayCalculation & { weekNumber: number; start: string; end: string }>
    payPeriod?: { start: string; end: string }
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [useCurrentPeriod, setUseCurrentPeriod] = useState(true)
  const [payPeriods, setPayPeriods] = useState<Array<{ start: string; end: string }>>([])
  const [selectedPeriod, setSelectedPeriod] = useState<{ start: string; end: string } | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<(PayCalculation & { weekNumber: number; start: string; end: string; entries?: Array<{ id: string; clockIn: string; clockOut: string | null; totalBreakMinutes: number; notes: string | null; breaks: Array<{ id: string; breakType: string; startTime: string; endTime: string | null; duration: number | null; notes: string | null }>; hours: number }> }) | null>(null)
  const [editingEntry, setEditingEntry] = useState<{ id: string; clockIn: string; clockOut: string | null; notes?: string | null; breaks?: Array<{ id: string; breakType: string; startTime: string; endTime: string | null; duration: number | null; notes: string | null }> } | null>(null)
  const { dialog, showAlert, closeDialog } = useDialog()

  useEffect(() => {
    loadUserProfile()
    loadPayPeriods()
  }, [])

  useEffect(() => {
    if (useCurrentPeriod && selectedPeriod) {
      loadPeriodEstimate(selectedPeriod.start, selectedPeriod.end)
    } else if (!useCurrentPeriod && hours) {
      // Don't auto-load if manually entering hours
    }
  }, [useCurrentPeriod, selectedPeriod])

  const loadUserProfile = async () => {
    try {
      const user = await userAPI.getProfile()
      setHourlyRate(user.hourlyRate)
    } catch (error) {
      console.error('Failed to load user profile:', error)
    }
  }

  const loadPayPeriods = async () => {
    try {
      const periods = await timesheetAPI.getPayPeriods()
      setPayPeriods(periods)
      if (periods.length > 0) {
        setSelectedPeriod(periods[0])
      }
    } catch (error) {
      console.error('Failed to load pay periods:', error)
    }
  }

  const loadPeriodEstimate = async (startDate?: string, endDate?: string) => {
    setLoading(true)
    try {
      const data = await paycheckAPI.getEstimate(startDate, endDate)
      setCalculation(data)
    } catch (error) {
      console.error('Failed to load estimate:', error)
      await showAlert('Error', 'Failed to load paycheck estimate')
    } finally {
      setLoading(false)
    }
  }

  const handleCalculate = async () => {
    if (!hours || !hourlyRate) {
      await showAlert('Validation Error', 'Please enter hours and hourly rate')
      return
    }

    setLoading(true)
    try {
      const data = await paycheckAPI.getEstimate(undefined, undefined, {
        hours: parseFloat(hours),
        hourlyRate
      })
      setCalculation(data)
    } catch (error) {
      console.error('Failed to calculate:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !calculation) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:pb-8" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Paycheck Calculator
          </h1>

        {/* Calculator Input */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="checkbox"
                id="useCurrentPeriod"
                checked={useCurrentPeriod}
                onChange={(e) => setUseCurrentPeriod(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="useCurrentPeriod" className="text-sm text-gray-700 dark:text-gray-300">
                Use pay period hours
              </label>
            </div>

            {useCurrentPeriod && payPeriods.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Pay Period
                </label>
                <select
                  value={selectedPeriod ? `${selectedPeriod.start}|${selectedPeriod.end}` : ''}
                  onChange={(e) => {
                    const [start, end] = e.target.value.split('|')
                    setSelectedPeriod({ start, end })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {payPeriods.map((period, index) => (
                    <option key={`${period.start}|${period.end}`} value={`${period.start}|${period.end}`}>
                      {formatDate(period.start)} - {formatDate(period.end)}
                      {index === 0 ? ' (Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!useCurrentPeriod && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Hours
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Hourly Rate
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            )}

            {!useCurrentPeriod && (
              <motion.button
                onClick={handleCalculate}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Calculate
              </motion.button>
            )}
          </div>
        </div>

        {/* Calculation Results */}
        {calculation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
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
            </div>

            {/* Weekly Breakdown */}
            {calculation.weeklyBreakdown && calculation.weeklyBreakdown.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Weekly Breakdown
                </h2>
                <div className="space-y-4">
                  {calculation.weeklyBreakdown.map((week) => (
                    <motion.div
                      key={week.weekNumber}
                      onClick={() => setSelectedWeek(week)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 cursor-pointer transition-shadow hover:shadow-md"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Week {week.weekNumber}
                        </h3>
                        <div className="text-right">
                          <div className="text-sm text-gray-600 dark:text-gray-400">Net Pay</div>
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(week.netPay)}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Hours</div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {formatHours(week.regularHours + week.overtimeHours)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Gross</div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(week.grossPay)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Taxes</div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(week.federalTax + week.stateTax + week.fica)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                        Click for details
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
        </motion.div>
      </div>

      {/* Week Breakdown Modal */}
      {selectedWeek && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedWeek(null)
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Week {selectedWeek.weekNumber} Breakdown
              </h2>
              <button
                onClick={() => setSelectedWeek(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Date Range</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDate(selectedWeek.start)} - {formatDate(selectedWeek.end)}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Hours</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatHours(selectedWeek.regularHours + selectedWeek.overtimeHours)}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Hours Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Regular Hours</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatHours(selectedWeek.regularHours)}
                    </span>
                  </div>
                  {selectedWeek.overtimeHours > 0 && (
                    <div className="flex justify-between">
                      <span className="text-orange-600 dark:text-orange-400">Overtime Hours</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {formatHours(selectedWeek.overtimeHours)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Pay Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Regular Pay</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(selectedWeek.regularPay)}
                    </span>
                  </div>
                  {selectedWeek.overtimePay > 0 && (
                    <div className="flex justify-between">
                      <span className="text-orange-600 dark:text-orange-400">Overtime Pay</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {formatCurrency(selectedWeek.overtimePay)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-gray-900 dark:text-white font-semibold">Gross Pay</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(selectedWeek.grossPay)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Tax Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Federal Tax</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(selectedWeek.federalTax)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">State Tax</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(selectedWeek.stateTax)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">FICA</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(selectedWeek.fica)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-gray-900 dark:text-white font-semibold">Total Taxes</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(selectedWeek.federalTax + selectedWeek.stateTax + selectedWeek.fica)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-500">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-blue-900 dark:text-blue-100">Net Pay</span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(selectedWeek.netPay)}
                  </span>
                </div>
              </div>

              {/* Time Entries */}
              {selectedWeek.entries && selectedWeek.entries.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Time Entries</h3>
                  <div className="space-y-2">
                    {selectedWeek.entries.map((entry) => (
                      <motion.div
                        key={entry.id}
                        onClick={async () => {
                          try {
                            const fullEntry = await timeEntriesAPI.getEntry(entry.id)
                            setEditingEntry({
                              id: fullEntry.id,
                              clockIn: fullEntry.clockIn,
                              clockOut: fullEntry.clockOut,
                              notes: fullEntry.notes || null,
                              breaks: fullEntry.breaks || []
                            })
                          } catch (error) {
                            console.error('Failed to load entry:', error)
                          }
                        }}
                        whileHover={{ scale: 1.01 }}
                        className="bg-white dark:bg-gray-800 rounded-lg p-3 cursor-pointer border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 dark:text-white text-sm">
                              {formatDateWithDay(entry.clockIn)}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {formatTime(entry.clockIn)} - {entry.clockOut ? formatTime(entry.clockOut) : 'Open'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {formatHours(entry.hours)} worked
                              {entry.totalBreakMinutes > 0 && ` • ${entry.totalBreakMinutes}m break`}
                            </div>
                            {entry.notes && (
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                                {entry.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Click to edit</div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingEntry(null)
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <EditEntryForm
              entry={editingEntry}
              onSave={async (updates) => {
                try {
                  await timeEntriesAPI.updateEntry(editingEntry.id, updates)
                  setEditingEntry(null)
                  // Reload the estimate to refresh the week breakdown
                  if (useCurrentPeriod && selectedPeriod) {
                    await loadPeriodEstimate(selectedPeriod.start, selectedPeriod.end)
                  }
                } catch (error: unknown) {
                  const axiosError = error as { response?: { data?: { error?: string } } }
                  await showAlert('Error', axiosError.response?.data?.error || 'Failed to save entry')
                }
              }}
              onCancel={() => setEditingEntry(null)}
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
    </>
  )
}

// Edit Entry Form Component (reused from Timesheet)
function EditEntryForm({ 
  entry, 
  onSave, 
  onCancel 
}: { 
  entry: { id: string; clockIn: string; clockOut: string | null; notes?: string | null; breaks?: Array<{ id: string; breakType: string; startTime: string; endTime: string | null; duration: number | null; notes: string | null }> }
  onSave: (updates: { clockIn: string; clockOut: string | null; notes?: string | null }) => void
  onCancel: () => void
}) {
  const [clockIn, setClockIn] = useState(() => new Date(entry.clockIn))
  const [clockOut, setClockOut] = useState(() => {
    if (entry.clockOut) {
      return new Date(entry.clockOut)
    }
    const defaultOut = new Date(entry.clockIn)
    defaultOut.setHours(defaultOut.getHours() + 1)
    return defaultOut
  })
  const [hasClockOut, setHasClockOut] = useState(!!entry.clockOut)
  const [notes, setNotes] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [breaks, setBreaks] = useState<Break[]>(() => {
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Entry</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

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
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
