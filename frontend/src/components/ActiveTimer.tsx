import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { TimeEntry, User } from '../types'

interface ActiveTimerProps {
  entry: TimeEntry
  user: User
}

export default function ActiveTimer({ entry, user }: ActiveTimerProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [earnings, setEarnings] = useState(0)

  useEffect(() => {
    const updateTimer = () => {
      // entry.clockIn is already rounded down to the previous interval by the backend
      // (e.g., if you clocked in at 5:02, it's stored as 5:00)
      const clockIn = new Date(entry.clockIn)
      const now = new Date()
      
      // Calculate elapsed time in milliseconds, then convert to seconds
      // This accounts for the rounding - if you clocked in at 5:02 (rounded to 5:00),
      // and it's now 5:02, elapsed will be 2 minutes (120 seconds)
      let elapsed = (now.getTime() - clockIn.getTime()) / 1000 // seconds
      
      // Ensure elapsed time is never negative (in case of timezone issues)
      elapsed = Math.max(0, elapsed)
      
      setElapsedTime(elapsed)

      // Calculate real-time earnings based on elapsed time
      const hours = elapsed / 3600
      const hourlyRate = user.hourlyRate || 0
      setEarnings(Math.max(0, hours * hourlyRate))
    }

    // Update immediately, then set interval
    updateTimer()
    const interval = setInterval(updateTimer, 1000) // Update every second

    return () => clearInterval(interval)
  }, [entry.clockIn, user.hourlyRate])

  const hours = Math.max(0, Math.floor(elapsedTime / 3600))
  const minutes = Math.max(0, Math.floor((elapsedTime % 3600) / 60))
  const seconds = Math.max(0, Math.floor(elapsedTime % 60))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl p-8 mb-6 text-white"
    >
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <p className="text-sm font-medium opacity-90 mb-2">CLOCKED IN</p>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm">Active</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="text-6xl font-bold mb-2 tabular-nums">
            {String(hours).padStart(2, '0')}:
            {String(minutes).padStart(2, '0')}:
            {String(seconds).padStart(2, '0')}
          </div>
          <p className="text-sm opacity-80">Time Elapsed</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/20 backdrop-blur-sm rounded-lg p-4"
        >
          <p className="text-sm opacity-90 mb-1">Current Earnings</p>
          <p className="text-3xl font-bold tabular-nums">
            ${earnings.toFixed(2)}
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
}

