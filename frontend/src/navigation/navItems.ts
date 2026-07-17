import {
  HomeIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  ClockIcon as ClockIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
} from '@heroicons/react/24/solid'

export type NavIcon = typeof HomeIcon

export type NavItem = {
  id: string
  path: string
  label: string
  icon: NavIcon
  iconSolid: NavIcon
  match?: string[]
  center?: boolean
}

/** Single source of truth for primary app navigation (all breakpoints / roles). */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    path: '/home',
    label: 'Home',
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
    match: ['/home', '/dashboard'],
  },
  {
    id: 'timesheet',
    path: '/timesheet',
    label: 'Timesheet',
    icon: DocumentTextIcon,
    iconSolid: DocumentTextIconSolid,
  },
  {
    id: 'clock',
    path: '/',
    label: 'Clock',
    icon: ClockIcon,
    iconSolid: ClockIconSolid,
    match: ['/', '/clock'],
    center: true,
  },
  {
    id: 'schedule',
    path: '/schedule',
    label: 'Schedule',
    icon: CalendarDaysIcon,
    iconSolid: CalendarDaysIconSolid,
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: Cog6ToothIcon,
    iconSolid: Cog6ToothIconSolid,
    match: ['/settings', '/profile', '/import', '/paycheck', '/admin', '/team'],
  },
]

export function pathMatchesNav(pathname: string, item: NavItem): boolean {
  const paths = item.match ?? [item.path]
  return paths.some((p) =>
    p === '/'
      ? pathname === '/' || pathname === '/clock'
      : pathname === p || pathname.startsWith(`${p}/`)
  )
}
