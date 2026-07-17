import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useClockNavStatus } from '../hooks/useClockNavStatus'

/**
 * Slim brand header for all breakpoints.
 * Primary navigation lives in AppBottomNav — this is not a second nav system.
 */
export default function TopBrandBar() {
  const { user } = useAuth()
  const { isClockedIn, onBreak } = useClockNavStatus()

  return (
    <header className="sticky top-0 z-40 border-b border-okami-border bg-okami-panel/90 backdrop-blur dark:bg-gray-900/90">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-okami-accent rounded-lg">
          <img src="/logo-icon.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-lg font-bold text-gray-900 dark:text-white">
            Hourly
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {isClockedIn && (
            <Link
              to="/"
              className="hidden items-center gap-2 rounded-lg bg-green-100 px-2.5 py-1.5 text-sm font-medium text-green-800 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 sm:inline-flex"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  onBreak ? 'bg-okami-warning' : 'bg-okami-success animate-pulse'
                }`}
                aria-hidden
              />
              {onBreak ? 'On break' : 'Clocked in'}
            </Link>
          )}

          <Link
            to="/settings"
            className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-okami-accent"
            aria-label="Settings"
          >
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt=""
                className="h-9 w-9 rounded-full border-2 border-okami-border object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-okami-border bg-gray-200 text-sm font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
