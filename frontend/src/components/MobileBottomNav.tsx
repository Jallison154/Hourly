import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  HomeIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  ClockIcon as ClockIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  EllipsisHorizontalIcon as EllipsisHorizontalIconSolid,
} from '@heroicons/react/24/solid'
import { timeEntriesAPI } from '../services/api'

const CLOCK_SIZE_PX = 68

type NavItem = {
  path: string
  label: string
  icon: typeof HomeIcon
  iconSolid: typeof HomeIconSolid
  match?: string[]
  center?: boolean
}

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
  },
  {
    path: '/timesheet',
    label: 'Timesheet',
    icon: DocumentTextIcon,
    iconSolid: DocumentTextIconSolid,
  },
  {
    path: '/',
    label: 'Clock',
    icon: ClockIcon,
    iconSolid: ClockIconSolid,
    match: ['/', '/clock'],
    center: true,
  },
  {
    path: '/schedule',
    label: 'Schedule',
    icon: CalendarDaysIcon,
    iconSolid: CalendarDaysIconSolid,
  },
  {
    path: '/profile',
    label: 'More',
    icon: EllipsisHorizontalIcon,
    iconSolid: EllipsisHorizontalIconSolid,
    match: ['/profile', '/import', '/paycheck', '/admin', '/team'],
  },
]

export default function MobileBottomNav() {
  const location = useLocation()
  const [isClockedIn, setIsClockedIn] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadStatus = async () => {
      try {
        const status = await timeEntriesAPI.getStatus()
        if (!cancelled) setIsClockedIn(Boolean(status.isClockedIn))
      } catch {
        // Silent fail — nav should still work offline / without status
      }
    }

    loadStatus()
    const interval = setInterval(loadStatus, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [location.pathname])

  const isActive = (item: NavItem) => {
    const paths = item.match ?? [item.path]
    return paths.some((p) =>
      p === '/'
        ? location.pathname === '/' || location.pathname === '/clock'
        : location.pathname.startsWith(p)
    )
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 overflow-visible sm:hidden"
      style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
      aria-label="Main"
    >
      {/* Raised clearance so the Clock button does not cover page content */}
      <div className="pointer-events-none h-7" aria-hidden />

      <div className="relative overflow-visible">
        {/* Bar surface with intentional center cutout for the raised Clock button */}
        <div
          className="absolute inset-0 border-t border-okami-border bg-okami-panel/95 backdrop-blur dark:bg-gray-900/95"
          style={{
            WebkitMaskImage:
              'radial-gradient(circle 40px at 50% 0px, transparent 36px, #000 37px)',
            maskImage:
              'radial-gradient(circle 40px at 50% 0px, transparent 36px, #000 37px)',
          }}
          aria-hidden
        />

        <div className="relative flex h-14 items-stretch">
          {navItems.map((item) => {
            const active = isActive(item)
            const Icon = active || item.center ? item.iconSolid : item.icon

            if (item.center) {
              return (
                <div
                  key={item.path}
                  className="relative z-10 flex min-w-0 flex-[1.2] items-end justify-center pb-0.5"
                >
                  <Link
                    to={item.path}
                    aria-label="Clock"
                    aria-current={active ? 'page' : undefined}
                    className="group flex w-full flex-col items-center justify-end"
                  >
                    <motion.div
                      whileTap={{ scale: 0.94 }}
                      transition={{ duration: 0.12 }}
                      className="relative -mb-0.5 flex flex-col items-center"
                      style={{ width: CLOCK_SIZE_PX }}
                    >
                      <motion.div
                        animate={
                          isClockedIn
                            ? {
                                boxShadow: [
                                  '0 8px 20px rgba(224, 122, 47, 0.35)',
                                  '0 8px 28px rgba(224, 122, 47, 0.55)',
                                  '0 8px 20px rgba(224, 122, 47, 0.35)',
                                ],
                              }
                            : {
                                boxShadow: '0 8px 22px rgba(28, 24, 20, 0.22)',
                              }
                        }
                        transition={
                          isClockedIn
                            ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                            : { duration: 0.2 }
                        }
                        className={`relative flex items-center justify-center rounded-full text-white ${
                          isClockedIn
                            ? 'bg-okami-accent ring-[3px] ring-okami-success/80 ring-offset-2 ring-offset-okami-panel dark:ring-offset-gray-900'
                            : 'bg-okami-accent'
                        }`}
                        style={{
                          width: CLOCK_SIZE_PX,
                          height: CLOCK_SIZE_PX,
                          marginTop: `-${Math.round(CLOCK_SIZE_PX * 0.42)}px`,
                        }}
                      >
                        <Icon className="h-8 w-8" aria-hidden />
                        {isClockedIn && (
                          <span
                            className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-okami-success ring-2 ring-white dark:ring-gray-900"
                            aria-hidden
                          />
                        )}
                      </motion.div>
                      <span
                        className={`mt-0.5 text-[10px] leading-none ${
                          active
                            ? 'font-semibold text-okami-accent'
                            : 'font-medium text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        Clock
                      </span>
                    </motion.div>
                  </Link>
                </div>
              )
            }

            return (
              <motion.div
                key={item.path}
                className="relative z-10 min-w-0 flex-1"
                whileTap={{ scale: 0.96, opacity: 0.85 }}
                transition={{ duration: 0.1 }}
              >
                <Link
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className="flex h-full min-h-[48px] w-full flex-col items-center justify-center gap-0.5 px-0.5"
                >
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute left-2 right-2 top-0 h-0.5 rounded-b-full bg-okami-accent"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={`h-6 w-6 shrink-0 ${
                      active ? 'text-okami-accent' : 'text-gray-500 dark:text-gray-400'
                    }`}
                    aria-hidden
                  />
                  <span
                    className={`max-w-full truncate text-[10px] leading-tight tracking-tight ${
                      active
                        ? 'font-semibold text-okami-accent'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
