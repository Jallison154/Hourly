import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  UserCircleIcon,
  AdjustmentsHorizontalIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  UsersIcon,
  BuildingOffice2Icon,
  ChevronRightIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../hooks/useAuth'
import { useDialog } from '../hooks/useDialog'
import Dialog from '../components/Dialog'
import PullToRefresh from '../components/PullToRefresh'

const APP_VERSION = '1.2.0'

type SettingsLink = {
  to: string
  label: string
  description?: string
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof UserCircleIcon
  children: React.ReactNode
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-okami-border bg-okami-panel shadow-sm">
      <div className="flex items-center gap-2 border-b border-okami-border px-4 py-3">
        <Icon className="h-5 w-5 text-okami-accent" aria-hidden />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <ul className="divide-y divide-okami-border">{children}</ul>
    </section>
  )
}

function Row({ to, label, description }: SettingsLink) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
          {description && (
            <p className="mt-0.5 text-xs text-okami-muted">{description}</p>
          )}
        </div>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
      </Link>
    </li>
  )
}

function StaticRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <li className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-3">
      <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
      <p className="text-sm text-okami-muted">{value}</p>
    </li>
  )
}

export default function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { dialog, showConfirm, closeDialog } = useDialog()
  const role = user?.role ?? 'EMPLOYEE'
  const isManager = role === 'MANAGER' || role === 'ADMIN'
  const isAdmin = role === 'ADMIN'
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true

  const handleRefresh = async () => {
    // Soft refresh — settings is mostly static links
  }

  const handleLogout = async () => {
    const ok = await showConfirm('Log out', 'Are you sure you want to log out?')
    if (!ok) return
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="mx-auto max-w-2xl px-4 py-6 page-with-nav sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Settings
          </h1>
          <p className="mt-1 text-sm text-okami-muted">
            Account, pay, and app preferences
            {role !== 'EMPLOYEE' ? ` · ${role}` : ''}
          </p>

          <div className="mt-6">
            <Section title="Account" icon={UserCircleIcon}>
              <Row
                to="/profile"
                label="Profile"
                description="Name, email, password, photo, timezone"
              />
              <li className="px-4 py-3">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full min-h-[44px] items-center gap-2 text-left text-sm font-medium text-okami-danger"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" aria-hidden />
                  Log out
                </button>
              </li>
            </Section>

            <Section title="Work preferences" icon={AdjustmentsHorizontalIcon}>
              <Row
                to="/profile#rounding"
                label="Time rounding"
                description="Interval used when clocking in and out"
              />
              <Row
                to="/schedule"
                label="Personal schedule"
                description="Planned weekly hours"
              />
              <Row
                to="/profile#timezone"
                label="Timezone & display"
                description="Local time zone for entries"
              />
            </Section>

            <Section title="Pay" icon={BanknotesIcon}>
              <Row
                to="/paycheck"
                label="Paycheck estimate"
                description="Gross, taxes, and net for a pay period"
              />
              <Row
                to="/profile#pay"
                label="Pay & tax settings"
                description="Rate, filing status, pay period, adjustments"
              />
            </Section>

            <Section title="App" icon={DevicePhoneMobileIcon}>
              <StaticRow label="Connection" value={online ? 'Online' : 'Offline'} />
              <StaticRow label="Version" value={`Hourly v${APP_VERSION}`} />
              <StaticRow label="Theme" value="System" />
              <StaticRow label="About" value="Okami Designs" />
            </Section>

            {isManager && (
              <Section title="Manager tools" icon={UsersIcon}>
                <Row
                  to="/admin"
                  label="Team dashboard"
                  description="Who is in, on break, or in overtime"
                />
                <Row
                  to="/admin"
                  label="Timesheet approvals"
                  description="Review submitted timesheets"
                />
                <Row
                  to="/schedule"
                  label="Team schedules"
                  description="Planning and availability"
                />
              </Section>
            )}

            {isAdmin && (
              <Section title="Administration" icon={BuildingOffice2Icon}>
                <Row
                  to="/admin"
                  label="Employees & roles"
                  description="People, roles, and status"
                />
                <Row
                  to="/import"
                  label="Import tools"
                  description="Import Hours Keeper CSV data"
                />
                <Row
                  to="/admin"
                  label="System & audit"
                  description="Health overview and audit history"
                />
              </Section>
            )}

            {/* Employees can still reach Import from App if needed historically — keep under App for all */}
            {!isAdmin && (
              <Section title="Data" icon={DevicePhoneMobileIcon}>
                <Row
                  to="/import"
                  label="Import"
                  description="Import time entries from CSV"
                />
              </Section>
            )}
          </div>
        </motion.div>

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
    </PullToRefresh>
  )
}
