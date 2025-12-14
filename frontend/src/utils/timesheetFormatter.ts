import { formatDate, formatDateWithDay, formatTime, formatHours, formatCurrency } from './date'
import type { TimesheetData } from '../types'

export function formatTimesheetAsText(timesheet: TimesheetData): string {
  let text = `TIMESHEET\n`
  text += `Pay Period: ${formatDate(timesheet.payPeriod.start)} - ${formatDate(timesheet.payPeriod.end)}\n`
  text += `Hourly Rate: ${formatCurrency(timesheet.user.hourlyRate)}/hr\n`
  if (timesheet.user.overtimeRate) {
    text += `Overtime Rate: ${timesheet.user.overtimeRate}x\n`
  }
  text += `\n`

  timesheet.weeks.forEach((week) => {
    text += `Week ${week.weekNumber}: ${formatDate(week.start)} - ${formatDate(week.end)}\n`
    text += `${'='.repeat(60)}\n\n`
    
    // Entry details
    week.entries.forEach((entry) => {
      text += `${formatDateWithDay(entry.clockIn)}\n`
      text += `  Clock In:  ${formatTime(entry.clockIn)}\n`
      if (entry.clockOut) {
        text += `  Clock Out: ${formatTime(entry.clockOut)}\n`
        text += `  Hours:     ${formatHours(entry.hours)}\n`
      } else {
        text += `  Clock Out: (In Progress)\n`
        text += `  Hours:     ${formatHours(entry.hours)} (ongoing)\n`
      }
      
      if (entry.breaks && entry.breaks.length > 0) {
        text += `  Breaks:\n`
        entry.breaks.forEach((b) => {
          const duration = b.duration || 0
          text += `    - ${b.breakType}: ${duration}m\n`
        })
      }
      
      if (entry.notes) {
        text += `  Notes: ${entry.notes}\n`
      }
      
      text += `\n`
    })
    
    // Week summary
    text += `Week ${week.weekNumber} Summary:\n`
    text += `  Total Hours: ${formatHours(week.totalHours)}\n`
    text += `  Regular Hours: ${formatHours(week.pay.regularHours)}\n`
    if (week.pay.overtimeHours > 0) {
      text += `  Overtime Hours: ${formatHours(week.pay.overtimeHours)}\n`
    }
    text += `  Gross Pay: ${formatCurrency(week.pay.grossPay)}\n`
    text += `  Net Pay: ${formatCurrency(week.pay.netPay)}\n`
    text += `\n${'='.repeat(60)}\n\n`
  })

  // Pay Period Totals
  text += `PAY PERIOD TOTALS\n`
  text += `${'='.repeat(60)}\n`
  text += `Total Hours: ${formatHours(timesheet.totals.totalHours)}\n`
  text += `Regular Hours: ${formatHours(timesheet.totals.regularHours)}\n`
  if (timesheet.totals.overtimeHours > 0) {
    text += `Overtime Hours: ${formatHours(timesheet.totals.overtimeHours)}\n`
  }
  text += `Gross Pay: ${formatCurrency(timesheet.totals.grossPay)}\n`
  text += `Federal Tax: ${formatCurrency(timesheet.totals.federalTax)}\n`
  text += `State Tax: ${formatCurrency(timesheet.totals.stateTax)}\n`
  text += `FICA: ${formatCurrency(timesheet.totals.fica)}\n`
  text += `Net Pay: ${formatCurrency(timesheet.totals.netPay)}\n`

  return text
}

