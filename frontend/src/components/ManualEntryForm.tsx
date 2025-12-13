import { useState } from 'react'
import { motion } from 'framer-motion'
import TimePicker from './TimePicker'
import { timeEntriesAPI } from '../services/api'
import type { TimeEntry } from '../types'

interface ManualEntryFormProps {
  onSuccess: () => void
  entry?: TimeEntry
}

export default function ManualEntryForm({ onSuccess, entry }: ManualEntryFormProps) {
  const [clockIn, setClockIn] = useState(entry ? new Date(entry.clockIn) : new Date())
  const [clockOut, setClockOut] = useState(entry?.clockOut ? new Date(entry.clockOut) : new Date())
  const [hasClockOut, setHasClockOut] = useState(!!entry?.clockOut)
  const [notes, setNotes] = useState(entry?.notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (entry) {
        await timeEntriesAPI.updateEntry(entry.id, {
          clockIn: clockIn.toISOString(),
          clockOut: hasClockOut ? clockOut.toISOString() : null,
          notes: notes || null
        })
      } else {
        await timeEntriesAPI.createEntry({
          clockIn: clockIn.toISOString(),
          clockOut: hasClockOut ? clockOut.toISOString() : undefined,
          notes: notes || undefined,
          isManualEntry: true
        })
      }
      onSuccess()
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to save entry')
    } finally {
      setLoading(false)
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
        />
      </div>

      <motion.button
        type="submit"
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97, opacity: 0.9 }}
        transition={{ duration: 0.1 }}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Saving...' : entry ? 'Update Entry' : 'Create Entry'}
      </motion.button>
    </form>
  )
}


