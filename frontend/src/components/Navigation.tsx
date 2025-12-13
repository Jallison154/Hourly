import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { timeEntriesAPI } from '../services/api'
import type { TimeEntry } from '../types'

export default function Navigation() {
  const { user } = useAuth()
  const location = useLocation()
  const [clockStatus, setClockStatus] = useState<{ isClockedIn: boolean; entry: TimeEntry | null } | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Check clock status
    const loadStatus = async () => {
      try {
        const status = await timeEntriesAPI.getStatus()
        setClockStatus(status)
      } catch (error) {
        // Silent fail - don't show errors for status check
      }
    }

    loadStatus()
    const statusInterval = setInterval(loadStatus, 5000) // Check every 5 seconds

    return () => {
      clearInterval(timeInterval)
      clearInterval(statusInterval)
    }
  }, [])

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/', label: 'Clock', icon: '⏰' },
    { path: '/timesheet', label: 'Timesheet', icon: '📋' },
    { path: '/calculator', label: 'Paycheck', icon: '💰' }
  ]

  return (
    <nav className="hidden sm:block bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <img src="/logo-icon.svg" alt="Hourly" className="w-8 h-8" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Hourly
                </h1>
              </Link>
            </div>
            <div className="ml-6 flex space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === item.path
                      ? 'border-blue-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Clock Status Indicator */}
            {clockStatus?.isClockedIn && (
              <Link
                to="/"
                className="flex items-center space-x-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Clocked In
                </span>
                {clockStatus.entry && (
                  <span className="text-xs text-green-600 dark:text-green-500 font-mono">
                    {(() => {
                      // clockIn is already rounded down to the previous interval by the backend
                      const clockIn = new Date(clockStatus.entry.clockIn)
                      const now = new Date()
                      const elapsed = Math.max(0, Math.floor((now.getTime() - clockIn.getTime()) / 1000))
                      const hours = Math.floor(elapsed / 3600)
                      const minutes = Math.floor((elapsed % 3600) / 60)
                      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
                    })()}
                  </span>
                )}
              </Link>
            )}
            
            {/* Current Time */}
            <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
              {currentTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: true 
              })}
            </div>

            <Link
              to="/profile"
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              {user?.profileImage ? (
                <img
                  src={user.profileImage}
                  alt={user?.name || 'Profile'}
                  className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 font-semibold border-2 border-gray-300 dark:border-gray-600">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}


