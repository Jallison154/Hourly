import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HomeIcon, ClockIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { HomeIcon as HomeIconSolid, ClockIcon as ClockIconSolid, DocumentTextIcon as DocumentTextIconSolid } from '@heroicons/react/24/solid'

export default function MobileBottomNav() {
  const location = useLocation()
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timeInterval)
  }, [])

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: HomeIcon, iconSolid: HomeIconSolid },
    { path: '/timesheet', label: 'Timesheet', icon: DocumentTextIcon, iconSolid: DocumentTextIconSolid },
    { path: '/', label: 'Clock', icon: ClockIcon, iconSolid: ClockIconSolid, oversized: true },
  ]

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 sm:hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) * 0.5)' }}>
      <div className="flex justify-around items-center h-14">
        {navItems.map((item, index) => {
          const active = isActive(item.path)
          const Icon = active ? item.iconSolid : item.icon
          const isOversized = item.oversized
          
          // Show time in the middle (index 1)
          if (index === 1) {
            return (
              <div key="time" className="flex-1 flex items-center justify-center">
                <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </div>
              </div>
            )
          }
          
          return (
            <motion.div
              key={item.path}
              className={`flex flex-col items-center justify-center relative ${isOversized ? 'flex-[1.5] -mt-6' : 'flex-1'}`}
              whileTap={{ scale: 0.97, opacity: 0.8 }}
              transition={{ duration: 0.1 }}
            >
              <Link
                to={item.path}
                className="flex flex-col items-center justify-center w-full h-full"
              >
                {isOversized ? (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl ${
                      active 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Icon className="w-10 h-10" />
                  </motion.div>
                ) : (
                  <>
                    {active && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute -top-1 left-0 right-0 h-1 bg-blue-600 rounded-b-full"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    <Icon className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`} />
                    <span className={`text-xs mt-1 ${active ? 'text-blue-600 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                      {item.label}
                    </span>
                  </>
                )}
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

