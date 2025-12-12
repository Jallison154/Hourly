import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { paycheckAPI, userAPI } from '../services/api'
import Dialog from '../components/Dialog'
import { useDialog } from '../hooks/useDialog'
import { formatCurrency, formatHours } from '../utils/date'
import type { PayCalculation } from '../types'

export default function PaycheckCalculator() {
  const [hourlyRate, setHourlyRate] = useState(0)
  const [hours, setHours] = useState('')
  const [calculation, setCalculation] = useState<PayCalculation & {
    hourlyRate?: number
    weeklyBreakdown?: Array<PayCalculation & { weekNumber: number; start: string; end: string }>
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [useCurrentPeriod, setUseCurrentPeriod] = useState(true)
  const { dialog, showAlert, closeDialog } = useDialog()

  useEffect(() => {
    loadUserProfile()
    if (useCurrentPeriod) {
      loadCurrentPeriodEstimate()
    }
  }, [useCurrentPeriod])

  const loadUserProfile = async () => {
    try {
      const user = await userAPI.getProfile()
      setHourlyRate(user.hourlyRate)
    } catch (error) {
      console.error('Failed to load user profile:', error)
    }
  }

  const loadCurrentPeriodEstimate = async () => {
    setLoading(true)
    try {
      const data = await paycheckAPI.getEstimate()
      setCalculation(data)
    } catch (error) {
      console.error('Failed to load estimate:', error)
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
      const data = await paycheckAPI.getEstimate({
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 sm:pb-8">
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
                Use current pay period hours
              </label>
            </div>

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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Pay Summary
              </h2>
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
                    <span className="text-gray-600 dark:text-gray-400">Montana State Tax (5.9%)</span>
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
                    <div
                      key={week.weekNumber}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
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
    </>
  )
}

