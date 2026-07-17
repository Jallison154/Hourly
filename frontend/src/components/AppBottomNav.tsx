import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PRIMARY_NAV_ITEMS, pathMatchesNav, type NavItem } from '../navigation/navItems'
import { useClockNavStatus } from '../hooks/useClockNavStatus'

/**
 * Shared primary navigation for mobile, tablet, PWA, and desktop.
 * Same items / icons / labels / clock status — layout adapts by breakpoint.
 */
export default function AppBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isClockedIn, onBreak } = useClockNavStatus()

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.center) {
      e.preventDefault()
      if (location.pathname !== '/') navigate('/')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (pathMatchesNav(location.pathname, item)) {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const clockTitle = onBreak
    ? 'Clock — on break'
    : isClockedIn
      ? 'Clock — clocked in'
      : 'Clock — clocked out'

  return (
    <nav
      className="
        pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center
        sm:px-4 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]
      "
      aria-label="Main"
    >
      <div
        className="
          pointer-events-auto relative w-full overflow-visible
          max-sm:pb-[max(0.25rem,env(safe-area-inset-bottom))]
          sm:w-[min(100%,48rem)] sm:max-w-[50rem]
        "
      >
        {/* Space for the raised Clock button so it sits above the dock surface */}
        <div className="pointer-events-none h-7 sm:h-8" aria-hidden />

        <div className="relative overflow-visible">
          <div
            className="
              absolute inset-0 border border-okami-border bg-okami-panel/95 shadow-panel backdrop-blur
              max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0
              sm:rounded-2xl dark:bg-gray-900/95
            "
            style={{
              WebkitMaskImage:
                'radial-gradient(circle 42px at 50% 0px, transparent 38px, #000 39px)',
              maskImage:
                'radial-gradient(circle 42px at 50% 0px, transparent 38px, #000 39px)',
            }}
            aria-hidden
          />

          <div className="relative flex h-14 items-stretch gap-0.5 px-1 sm:h-16 sm:gap-1 sm:px-2">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active = pathMatchesNav(location.pathname, item)
              const Icon = active || item.center ? item.iconSolid : item.icon

              if (item.center) {
                return (
                  <div
                    key={item.id}
                    className="relative z-10 flex min-w-0 flex-[1.15] items-end justify-center pb-0.5 sm:flex-[1.25]"
                  >
                    <Link
                      to={item.path}
                      title={clockTitle}
                      aria-label={clockTitle}
                      aria-current={active ? 'page' : undefined}
                      onClick={(e) => handleNavClick(item, e)}
                      className="
                        group flex w-full flex-col items-center justify-end rounded-xl
                        outline-none focus-visible:ring-2 focus-visible:ring-okami-accent
                        focus-visible:ring-offset-2 focus-visible:ring-offset-okami-panel
                        dark:focus-visible:ring-offset-gray-900
                      "
                    >
                      <motion.div
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ duration: 0.12 }}
                        className="relative -mb-0.5 flex flex-col items-center"
                      >
                        <motion.div
                          animate={
                            isClockedIn
                              ? {
                                  boxShadow: [
                                    '0 8px 20px rgba(224, 122, 47, 0.32)',
                                    '0 8px 28px rgba(224, 122, 47, 0.5)',
                                    '0 8px 20px rgba(224, 122, 47, 0.32)',
                                  ],
                                }
                              : { boxShadow: '0 8px 22px rgba(28, 24, 20, 0.2)' }
                          }
                          transition={
                            isClockedIn
                              ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                              : { duration: 0.2 }
                          }
                          className={`
                            relative -mt-7 flex size-[68px] items-center justify-center rounded-full
                            bg-okami-accent text-white transition-colors
                            group-hover:bg-okami-accent-hover
                            sm:-mt-8 sm:size-[76px]
                            ${
                              isClockedIn
                                ? onBreak
                                  ? 'ring-[3px] ring-okami-warning/90 ring-offset-2 ring-offset-okami-panel dark:ring-offset-gray-900'
                                  : 'ring-[3px] ring-okami-success/80 ring-offset-2 ring-offset-okami-panel dark:ring-offset-gray-900'
                                : ''
                            }
                          `}
                        >
                          <Icon className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden />
                          {isClockedIn && (
                            <span
                              className={`
                                absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full
                                ring-2 ring-white dark:ring-gray-900
                                ${onBreak ? 'bg-okami-warning' : 'bg-okami-success animate-pulse'}
                              `}
                              aria-hidden
                            />
                          )}
                        </motion.div>
                        <span
                          className={`
                            mt-0.5 text-[10px] leading-none sm:text-[11px]
                            ${
                              active
                                ? 'font-semibold text-okami-accent'
                                : 'font-medium text-gray-500 dark:text-gray-400'
                            }
                          `}
                        >
                          Clock
                        </span>
                      </motion.div>
                    </Link>
                  </div>
                )
              }

              return (
                <div key={item.id} className="relative z-10 min-w-0 flex-1">
                  <Link
                    to={item.path}
                    aria-current={active ? 'page' : undefined}
                    aria-label={item.label}
                    title={item.label}
                    onClick={(e) => handleNavClick(item, e)}
                    className={`
                      group flex h-full min-h-[48px] w-full cursor-pointer flex-col items-center
                      justify-center gap-0.5 rounded-xl px-0.5 outline-none transition-colors
                      sm:min-h-[56px]
                      focus-visible:ring-2 focus-visible:ring-okami-accent
                      focus-visible:ring-offset-2 focus-visible:ring-offset-okami-panel
                      dark:focus-visible:ring-offset-gray-900
                      ${
                        active
                          ? 'bg-orange-50/80 text-okami-accent dark:bg-orange-950/35'
                          : 'text-gray-500 hover:bg-black/[0.04] hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200'
                      }
                    `}
                  >
                    {active && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute left-2 right-2 top-0 h-0.5 rounded-b-full bg-okami-accent sm:left-3 sm:right-3"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    <motion.span
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ duration: 0.1 }}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <Icon
                        className={`h-6 w-6 shrink-0 sm:h-[22px] sm:w-[22px] ${
                          active ? 'text-okami-accent' : ''
                        }`}
                        aria-hidden
                      />
                      <span
                        className={`
                          max-w-full truncate text-[10px] leading-tight tracking-tight sm:text-[11px]
                          ${active ? 'font-semibold text-okami-accent' : 'font-medium'}
                        `}
                      >
                        {item.label}
                      </span>
                    </motion.span>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
