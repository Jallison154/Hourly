import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ClockIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline'
import {
  ClockIcon as ClockIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  EllipsisHorizontalIcon as EllipsisHorizontalIconSolid,
} from '@heroicons/react/24/solid'

const navItems = [
  { path: '/', label: 'Clock', icon: ClockIcon, iconSolid: ClockIconSolid, match: ['/', '/clock'] },
  { path: '/timesheet', label: 'Timesheet', icon: DocumentTextIcon, iconSolid: DocumentTextIconSolid },
  { path: '/schedule', label: 'Schedule', icon: CalendarDaysIcon, iconSolid: CalendarDaysIconSolid },
  { path: '/paycheck', label: 'Paycheck', icon: BanknotesIcon, iconSolid: BanknotesIconSolid },
  { path: '/profile', label: 'More', icon: EllipsisHorizontalIcon, iconSolid: EllipsisHorizontalIconSolid, match: ['/profile', '/import', '/dashboard'] },
]

export default function MobileBottomNav() {
  const location = useLocation()

  const isActive = (item: (typeof navItems)[number]) => {
    const paths = item.match ?? [item.path]
    return paths.some((p) =>
      p === '/' ? location.pathname === '/' || location.pathname === '/clock' : location.pathname.startsWith(p)
    )
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-okami-border bg-okami-panel/95 backdrop-blur sm:hidden dark:bg-gray-900/95"
      style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
      aria-label="Main"
    >
      <div className="flex items-stretch h-14">
        {navItems.map((item) => {
          const active = isActive(item)
          const Icon = active ? item.iconSolid : item.icon
          return (
            <motion.div
              key={item.path}
              className="flex-1 relative"
              whileTap={{ scale: 0.96, opacity: 0.85 }}
              transition={{ duration: 0.1 }}
            >
              <Link
                to={item.path}
                className="flex flex-col items-center justify-center w-full h-full min-h-[44px] gap-0.5"
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-2 right-2 h-0.5 bg-okami-accent rounded-b-full"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon
                  className={`w-6 h-6 ${active ? 'text-okami-accent' : 'text-gray-500 dark:text-gray-400'}`}
                />
                <span
                  className={`text-[10px] leading-tight ${
                    active
                      ? 'text-okami-accent font-semibold'
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
    </nav>
  )
}
