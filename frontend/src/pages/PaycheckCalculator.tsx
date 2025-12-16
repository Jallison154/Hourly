import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { paycheckAPI, userAPI, timesheetAPI } from '../services/api'
import Dialog from '../components/Dialog'
import { useDialog } from '../hooks/useDialog'
import { formatCurrency, formatHours, formatDate } from '../utils/date'
import type { PayCalculation } from '../types'

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
  const [selectedWeek, setSelectedWeek] = useState<(PayCalculation & { weekNumber: number; start: string; end: string }) | null>(null)
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
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
    </>
  )
}

