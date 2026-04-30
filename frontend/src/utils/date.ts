import { format, parseISO } from 'date-fns'

type DateInput = string | Date

function toDate(d: DateInput): Date {
  return typeof d === 'string' ? parseISO(d) : d
}

/** Calendar date in the user's local timezone (for `<input type="date">`). Avoids UTC drift from `toISOString().slice(0, 10)`. */
export function toLocalDateInputValue(d: DateInput): string {
  const date = toDate(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Local wall-clock time (for `<input type="time">`). */
export function toLocalTimeInputValue(d: DateInput): string {
  const date = toDate(d)
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${min}`
}

/** Interpret date + time strings as local civil time (same as native date/time inputs). */
export function fromLocalDateAndTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}`)
}

export function formatDateTime(date: DateInput, timeZone?: string | null): string {
  const d = toDate(date)
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(d)
    } catch {
      // Fallback if timezone is invalid
      return format(d, 'MMM d, yyyy h:mm a')
    }
  }
  return format(d, 'MMM d, yyyy h:mm a')
}

export function formatDate(date: DateInput, timeZone?: string | null): string {
  const d = toDate(date)
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium' }).format(d)
    } catch {
      return format(d, 'MMM d, yyyy')
    }
  }
  return format(d, 'MMM d, yyyy')
}

export function formatDateWithDay(date: DateInput, timeZone?: string | null): string {
  const d = toDate(date)
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', dateStyle: 'medium' }).format(d)
    } catch {
      return format(d, 'EEEE, MMM d, yyyy')
    }
  }
  return format(d, 'EEEE, MMM d, yyyy')
}

export function formatTime(date: DateInput, timeZone?: string | null): string {
  const d = toDate(date)
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone, timeStyle: 'short' }).format(d)
    } catch {
      return format(d, 'h:mm a')
    }
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
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', weekday: 'short' }).format(d)
    } catch {
      return format(d, 'MMM d (EEE)')
    }
  }
  return format(d, 'MMM d (EEE)')
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}


