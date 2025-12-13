export interface User {
  id: string
  email: string
  name: string
  hourlyRate: number
  overtimeRate?: number
  timeRoundingInterval?: number
  profileImage?: string | null
  payPeriodType?: 'weekly' | 'monthly'
  payPeriodEndDay?: number
  paycheckAdjustment?: number
  state?: string | null
  stateTaxRate?: number | null
}

export interface TimeEntry {
  id: string
  userId: string
  clockIn: string
  clockOut: string | null
  totalBreakMinutes: number
  notes: string | null
  isManualEntry: boolean
  createdAt: string
  updatedAt: string
  breaks: Break[]
}

export interface Break {
  id: string
  timeEntryId: string
  breakType: 'lunch' | 'rest' | 'other'
  startTime: string
  endTime: string | null
  duration: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PayCalculation {
  regularHours: number
  overtimeHours: number
  regularPay: number
  overtimePay: number
  grossPay: number
  federalTax: number
  stateTax: number
  fica: number
  netPay: number
  stateTaxRate?: number // The state tax rate used for calculations (for display)
}

export interface PayPeriod {
  start: string
  end: string
}

export interface Week {
  start: string
  end: string
  weekNumber: number
}

export interface TimesheetData {
  payPeriod: PayPeriod
  user: {
    name: string
    hourlyRate: number
    overtimeRate?: number
  }
  weeks: Array<{
    weekNumber: number
    start: string
    end: string
    entries: Array<TimeEntry & { hours: number; breakHours: number }>
    totalHours: number
    previousPayPeriodHours?: number // Hours from previous pay period in this week (for accurate overtime calculation)
    pay: PayCalculation
  }>
  totals: PayCalculation & { totalHours: number }
  entries: Array<TimeEntry & { hours: number; breakHours: number }>
}

export interface Metrics {
  payPeriod: PayPeriod
  currentPeriod: {
    totalHours: number
    completedEntries: number
    avgHoursPerDay: number
    daysWorked: number
  } & PayCalculation
  patterns: {
    avgClockIn: { hour: number; minute: number } | null
    avgClockOut: { hour: number; minute: number } | null
  }
  dailyHours: { [key: string]: number }
  recentActivity: {
    last30DaysHours: number
    last30DaysEntries: number
  }
}


