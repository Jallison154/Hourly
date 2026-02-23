import { format, parseISO } from 'date-fns'

type DateInput = string | Date

function toDate(d: DateInput): Date {
  return typeof d === 'string' ? parseISO(d) : d
}

export function formatDateTime(date: DateInput, timeZone?: string | null): string {
  const d = toDate(date)
  if (timeZone) {
    return new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(d)
  }
  return format(d, 'MMM d, yyyy h:mm a')
}

export function formatDate(date: DateInput, timeZone?: string | null): string {
  const d = toDate(date)
  if (timeZone) {
    return new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium' }).format(d)
  }
  return format(d, 'MMM d, yyyy')
}

export function formatDateWithDay(date: DateInput, timeZone?: string | null): string {
  const d = toDate(date)
  if (timeZone) {
    return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', dateStyle: 'medium' }).format(d)
  }
  return format(d, 'EEEE, MMM d, yyyy')
}

export function formatTime(date: DateInput, timeZone?: string | null): string {
  const d = toDate(date)
  if (timeZone) {
    return new Intl.DateTimeFormat('en-US', { timeZone, timeStyle: 'short' }).format(d)
  }
  return format(d, 'h:mm a')
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

export function formatDateWithDayShort(date: DateInput, timeZone?: string | null): string {
  const d = toDate(date)
  if (timeZone) {
    return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', weekday: 'short' }).format(d)
  }
  return format(d, 'MMM d (EEE)')
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}


