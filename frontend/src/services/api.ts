import axios from 'axios'
import type { User, TimeEntry, Break, PayCalculation, TimesheetData, Metrics, PayPeriod } from '../types'

// Auto-detect API URL for mobile access
// If VITE_API_URL is set, use it. Otherwise, try to detect the server IP
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // If we're on localhost, try to use the hostname (works for mobile on same network)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // If accessing from a mobile device, use the hostname (server IP)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:5000/api`
    }
  }
  
  // Default to localhost for development
  return 'http://localhost:5000/api'
}

const API_URL = getApiUrl()

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth API
export const authAPI = {
  register: async (email: string, password: string, name: string, hourlyRate?: number) => {
    const { data } = await api.post('/auth/register', { email, password, name, hourlyRate })
    if (data.token) {
      localStorage.setItem('token', data.token)
    }
    return data
  },
  
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    if (data.token) {
      localStorage.setItem('token', data.token)
    }
    return data
  },
  
  logout: () => {
    localStorage.removeItem('token')
  }
}

// User API
export const userAPI = {
  getProfile: async (): Promise<User> => {
    const { data } = await api.get('/user/profile')
    return data
  },
  
  updateProfile: async (updates: {
    name?: string
    hourlyRate?: number
    overtimeRate?: number
    timeRoundingInterval?: number
    profileImage?: string | null
    payPeriodType?: 'weekly' | 'monthly'
    payPeriodEndDay?: number
  }): Promise<User> => {
    const { data } = await api.put('/user/profile', updates)
    return data
  }
}

// Time Entries API
export const timeEntriesAPI = {
  getStatus: async () => {
    const { data } = await api.get('/time-entries/status')
    return data
  },
  
  clockIn: async (clockInTime?: string): Promise<TimeEntry> => {
    const { data } = await api.post('/time-entries/clock-in', { clockInTime })
    return data
  },
  
  clockOut: async (clockOutTime?: string): Promise<TimeEntry> => {
    const { data } = await api.post('/time-entries/clock-out', { clockOutTime })
    return data
  },
  
  getEntries: async (startDate?: string, endDate?: string): Promise<TimeEntry[]> => {
    const params: any = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const { data } = await api.get('/time-entries', { params })
    return data
  },
  
  getEntry: async (id: string): Promise<TimeEntry> => {
    const { data } = await api.get(`/time-entries/${id}`)
    return data
  },
  
  createEntry: async (entry: {
    clockIn: string
    clockOut?: string
    notes?: string
    isManualEntry?: boolean
  }): Promise<TimeEntry> => {
    const { data } = await api.post('/time-entries', entry)
    return data
  },
  
  updateEntry: async (id: string, updates: {
    clockIn?: string
    clockOut?: string | null
    notes?: string | null
    totalBreakMinutes?: number
  }): Promise<TimeEntry> => {
    const { data } = await api.put(`/time-entries/${id}`, updates)
    return data
  },
  
  deleteEntry: async (id: string): Promise<void> => {
    await api.delete(`/time-entries/${id}`)
  },
  
  addBreak: async (entryId: string, breakData: {
    breakType: 'lunch' | 'rest' | 'other'
    startTime: string
    endTime?: string
    duration?: number
    notes?: string
  }): Promise<Break> => {
    const { data } = await api.post(`/time-entries/${entryId}/breaks`, breakData)
    return data
  },
  
  updateBreak: async (breakId: string, updates: {
    breakType?: 'lunch' | 'rest' | 'other'
    startTime?: string
    endTime?: string | null
    duration?: number | null
    notes?: string | null
  }): Promise<Break> => {
    const { data } = await api.put(`/time-entries/breaks/${breakId}`, updates)
    return data
  },
  
  deleteBreak: async (breakId: string): Promise<void> => {
    await api.delete(`/time-entries/breaks/${breakId}`)
  },
  
  deleteBulk: async (startDate: string, endDate: string): Promise<{ deletedCount: number; message: string }> => {
    // Use POST instead of DELETE since some browsers/proxies don't support DELETE with body
    const { data } = await api.post('/time-entries/bulk-delete', {
      startDate,
      endDate
    })
    return data
  }
}

// Timesheet API
export const timesheetAPI = {
  getTimesheet: async (startDate?: string, endDate?: string): Promise<TimesheetData> => {
    if (startDate && endDate) {
      // Encode dates for URL path (replace colons and other special chars)
      const encodedStart = encodeURIComponent(startDate)
      const encodedEnd = encodeURIComponent(endDate)
      const { data } = await api.get(`/timesheet/${encodedStart}/${encodedEnd}`)
      return data
    }
    const { data } = await api.get('/timesheet')
    return data
  },
  getPayPeriods: async (): Promise<Array<{ start: string; end: string }>> => {
    const { data } = await api.get('/timesheet/periods')
    return data
  }
}

// Paycheck API
export const paycheckAPI = {
  getEstimate: async (params?: {
    hours?: number
    hourlyRate?: number
    startDate?: string
    endDate?: string
  }): Promise<PayCalculation & {
    hourlyRate: number
    hours?: number
    payPeriod?: PayPeriod
    weeklyBreakdown?: Array<PayCalculation & { weekNumber: number; start: string; end: string }>
  }> => {
    const { data } = await api.get('/paycheck/estimate', { params })
    return data
  }
}

// Metrics API
export const metricsAPI = {
  getMetrics: async (): Promise<Metrics> => {
    const { data } = await api.get('/metrics')
    return data
  }
}

// Import API
export const importAPI = {
  importHoursKeeper: async (params: {
    csvContent: string
    startDate?: string
    endDate?: string
  }): Promise<{
    success: boolean
    imported: number
    skipped: number
    total: number
  }> => {
    const { data } = await api.post('/import', params)
    return data
  }
}

export default api


