import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TimePickerProps {
  value: Date
  onChange: (date: Date) => void
  label: string
}

export default function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [date, setDate] = useState(value.toISOString().split('T')[0])
  const [time, setTime] = useState(value.toTimeString().slice(0, 5))

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value)
    const newDate = new Date(`${e.target.value}T${time}`)
    onChange(newDate)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value)
    const newDate = new Date(`${date}T${e.target.value}`)
    onChange(newDate)
  }

  const useNow = () => {
    const now = new Date()
    setDate(now.toISOString().split('T')[0])
    setTime(now.toTimeString().slice(0, 5))
    onChange(now)
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-left"
      >
        {value.toLocaleString()}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={handleDateChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={handleTimeChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={useNow}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Use Current Time
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


