import { formatDate, formatHours } from './date'
import type { TimesheetData } from '../types'

export function formatTimesheetAsText(timesheet: TimesheetData): string {
  let text = `TIMESHEET\n`
  text += `Pay Period: ${formatDate(timesheet.payPeriod.start)} - ${formatDate(timesheet.payPeriod.end)}\n\n`

  timesheet.weeks.forEach((week) => {
    text += `Week ${week.weekNumber}: ${formatDate(week.start)} - ${formatDate(week.end)}\n`
    text += `Hours: ${formatHours(week.totalHours)}\n\n`
  })

  text += `Total Hours: ${formatHours(timesheet.totals.totalHours)}\n`

  return text
}

