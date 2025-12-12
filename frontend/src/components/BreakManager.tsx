import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TimePicker from './TimePicker'
import Dialog from './Dialog'
import { useDialog } from '../hooks/useDialog'
import { timeEntriesAPI } from '../services/api'
import { formatTime } from '../utils/date'
import type { TimeEntry } from '../types'

interface BreakManagerProps {
  entry: TimeEntry
  onUpdate: () => void
}

export default function BreakManager({ entry, onUpdate }: BreakManagerProps) {
  const [showAddBreak, setShowAddBreak] = useState(false)
  const [breakType, setBreakType] = useState<'lunch' | 'rest' | 'other'>('lunch')
  const [startTime, setStartTime] = useState(new Date())
  const [endTime, setEndTime] = useState(new Date())
  const [hasEndTime, setHasEndTime] = useState(true)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showAlert, showConfirm, closeDialog } = useDialog()

  const handleAddBreak = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await timeEntriesAPI.addBreak(entry.id, {
        breakType,
        startTime: startTime.toISOString(),
        endTime: hasEndTime ? endTime.toISOString() : undefined,
        notes: notes || undefined
      })
      setShowAddBreak(false)
      setNotes('')
      onUpdate()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add break')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBreak = async (breakId: string) => {
    const confirmed = await showConfirm('Delete Break', 'Delete this break?', 'Delete', 'Cancel')
    if (!confirmed) return

    try {
      await timeEntriesAPI.deleteBreak(breakId)
      onUpdate()
    } catch (err: any) {
      await showAlert('Error', err.response?.data?.error || 'Failed to delete break')
    }
  }

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Breaks</h3>
        {!entry.clockOut && (
          <motion.button
            onClick={() => setShowAddBreak(!showAddBreak)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
          >
            + Add Break
          </motion.button>
        )}
      </div>

      {entry.breaks.length > 0 && (
        <div className="space-y-2 mb-4">
          {entry.breaks.map((b) => (
            <div
              key={b.id}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex justify-between items-center"
            >
              <div>
                <div className="font-semibold text-gray-900 dark:text-white capitalize">
                  {b.breakType}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formatTime(b.startTime)}
                  {b.endTime && ` - ${formatTime(b.endTime)}`}
                  {b.duration && ` (${b.duration}m)`}
                </div>
                {b.notes && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{b.notes}</div>
                )}
              </div>
              {!entry.clockOut && (
                <button
                  onClick={() => handleDeleteBreak(b.id)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAddBreak && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddBreak}
            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4"
          >
            {error && (
              <div className="p-2 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Break Type
              </label>
              <select
                value={breakType}
                onChange={(e) => setBreakType(e.target.value as 'lunch' | 'rest' | 'other')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              >
                <option value="lunch">Lunch</option>
                <option value="rest">Rest Break</option>
                <option value="other">Other</option>
              </select>
            </div>

            <TimePicker
              value={startTime}
              onChange={setStartTime}
              label="Start Time"
            />

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hasEndTime"
                checked={hasEndTime}
                onChange={(e) => setHasEndTime(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="hasEndTime" className="text-sm text-gray-700 dark:text-gray-300">
                Has end time
              </label>
            </div>

            {hasEndTime && (
              <TimePicker
                value={endTime}
                onChange={setEndTime}
                label="End Time"
              />
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="flex space-x-2">
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Break'}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  setShowAddBreak(false)
                  setError('')
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
              >
                Cancel
              </motion.button>
            </div>
          </motion.form>
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
  )
}


