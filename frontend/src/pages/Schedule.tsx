import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useDialog } from '../hooks/useDialog'
import Dialog from '../components/Dialog'
import PullToRefresh from '../components/PullToRefresh'
import { userAPI } from '../services/api'
import type { WeeklySchedule } from '../types'
import { formatCurrency } from '../utils/date'

export default function Schedule() {
  const { user } = useAuth()
  const { dialog, showAlert, closeDialog } = useDialog()
  const [schedule, setSchedule] = useState<WeeklySchedule>({
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
    saturday: 0,
    sunday: 0
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSchedule()
  }, [])

  const loadSchedule = async () => {
    try {
      setLoading(true)
      const data = await userAPI.getSchedule()
      setSchedule(data)
    } catch (error) {
      console.error('Failed to load schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleScheduleChange = (day: keyof WeeklySchedule, value: number) => {
    setSchedule({ ...schedule, [day]: Math.max(0, Math.min(24, value)) })
  }

  const handleSaveSchedule = async () => {
    setSaving(true)
    try {
      await userAPI.updateSchedule(schedule)
      await showAlert('Success', 'Weekly schedule saved successfully!')
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      await showAlert('Error', axiosError.response?.data?.error || 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const getTotalWeeklyHours = () => {
    return (schedule.monday || 0) + 
           (schedule.tuesday || 0) + 
           (schedule.wednesday || 0) + 
           (schedule.thursday || 0) + 
           (schedule.friday || 0) + 
           (schedule.saturday || 0) + 
           (schedule.sunday || 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={loadSchedule}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:pb-8" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Weekly Schedule
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Set your estimated hours for each day of the week to help plan your work schedule.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
        >
          <div className="space-y-4">
            {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
              <div key={day} className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                <label className="flex-1 text-base font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {day}
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.25"
                    value={schedule[day] || 0}
                    onChange={(e) => handleScheduleChange(day, parseFloat(e.target.value) || 0)}
                    className="w-28 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-10">hours</span>
                </div>
              </div>
            ))}
            
            <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Total Weekly Hours
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {getTotalWeeklyHours().toFixed(2)}
                  </div>
                </div>
                {user?.hourlyRate && getTotalWeeklyHours() > 0 && (
                  <>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Estimated Weekly Pay
                      </div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(getTotalWeeklyHours() * user.hourlyRate)}
                      </div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Estimated Monthly Pay
                      </div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {formatCurrency(getTotalWeeklyHours() * 4.33 * user.hourlyRate)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <motion.button
              type="button"
              onClick={handleSaveSchedule}
              disabled={saving}
              whileHover={{ scale: saving ? 1 : 1.02 }}
              whileTap={{ scale: saving ? 1 : 0.98 }}
              className="w-full mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-lg transition-colors text-lg"
            >
              {saving ? 'Saving...' : 'Save Schedule'}
            </motion.button>
          </div>
        </motion.div>

        <Dialog {...dialog} onClose={closeDialog} />
      </div>
    </PullToRefresh>
  )
}
