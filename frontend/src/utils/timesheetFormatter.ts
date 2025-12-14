import { format, parseISO } from 'date-fns'
import { formatHours } from './date'
import type { TimesheetData } from '../types'

function formatDateRange(start: string | Date, end: string | Date): string {
  const startDate = typeof start === 'string' ? parseISO(start) : start
  const endDate = typeof end === 'string' ? parseISO(end) : end
  
  const startMonth = format(startDate, 'MMM')
  const startDay = format(startDate, 'd')
  const endMonth = format(endDate, 'MMM')
  const endDay = format(endDate, 'd')
  
  // If same month, show "Nov 11-15", otherwise "Nov 30-Dec 6"
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`
  } else {
    return `${startMonth} ${startDay}-${endMonth} ${endDay}`
  }
}

export function formatTimesheetAsText(timesheet: TimesheetData): string {
  let text = `Total Hours: ${formatHours(timesheet.totals.totalHours)}\n\n`

  timesheet.weeks.forEach((week) => {
    text += `${formatDateRange(week.start, week.end)}: ${formatHours(week.totalHours)}\n`
  })

  return text
}

