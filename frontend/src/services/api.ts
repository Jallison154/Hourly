import axios from 'axios'
import { Capacitor } from '@capacitor/core'
import type { User, TimeEntry, Break, PayCalculation, TimesheetData, Metrics, PayPeriod } from '../types'

// Auto-detect API URL for mobile access
// If VITE_API_URL is set, use it. Otherwise, try to detect the server IP
const getApiUrl = () => {
  const isDev = import.meta.env.DEV
  const isNative = Capacitor.isNativePlatform()
  
  // Check for explicit API URL in environment variable
  if (import.meta.env.VITE_API_URL) {
    if (isDev) console.log('Using VITE_API_URL:', import.meta.env.VITE_API_URL)
    return import.meta.env.VITE_API_URL
  }
  
  // If running in Capacitor (native iOS app), use a configurable backend URL
  // For production, you'll need to set this to your actual backend server
  if (isNative) {
    // You can set this to your backend server URL
    // For local development, use your Mac's IP address (e.g., http://192.168.1.100:5000/api)
    // For production, use your deployed backend URL
    const nativeApiUrl = import.meta.env.VITE_NATIVE_API_URL || 'http://localhost:5000/api'
    if (isDev) console.log('Using native API URL:', nativeApiUrl)
    return nativeApiUrl
  }
  
  // If we're in the browser, use the current hostname (works for mobile on same network)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const protocol = window.location.protocol
    
    // If accessing from localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // In dev mode (npm run dev), Vite proxy handles /api -> localhost:5000
      if (isDev) {
        const relativeUrl = '/api'
        if (isDev) console.log('Using relative API URL for dev proxy:', relativeUrl)
        return relativeUrl
      }
      
      // In preview mode (built files), vite preview doesn't have a proxy
      // So we need to use the full localhost:5000 URL
      const apiUrl = 'http://localhost:5000/api'
      if (isDev) console.log('Using localhost API URL for preview mode (no proxy):', apiUrl)
      return apiUrl
    }
    
    // If accessing from a mobile device or remote IP, use the hostname (server IP)
    // Always use port 5000 for the backend API
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '') {
      // Always use http for local network IPs (Safari requires explicit protocol)
      // Match common private IP ranges
      const isPrivateIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(hostname)
      const apiProtocol = isPrivateIP ? 'http' : (protocol === 'https:' ? 'https' : 'http')
      const apiUrl = `${apiProtocol}://${hostname}:5000/api`
      if (isDev) console.log('Detected remote access:', { hostname, isPrivateIP, apiProtocol, apiUrl })
      return apiUrl
    }
  }
  
  // Default fallback: use localhost:5000 for local development/preview
  // This handles cases where we can't detect the environment properly
  const defaultUrl = 'http://localhost:5000/api'
  if (isDev) console.log('Using default API URL (fallback):', defaultUrl)
  return defaultUrl
}

const API_URL = getApiUrl()
if (import.meta.env.DEV) console.log('API URL configured:', API_URL)

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
  if (import.meta.env.DEV) {
    console.log('API Request:', config.method?.toUpperCase(), config.url, 'to', config.baseURL)
  }
  return config
})

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log('API Response:', response.status, response.config.url)
    }
    return response
  },
  (error) => {
    // Always log errors, but with less detail in production
    if (import.meta.env.DEV) {
      console.error('API Error Details:')
      console.error('  Status:', error.response?.status)
      console.error('  Status Text:', error.response?.statusText)
      console.error('  Data:', error.response?.data)
      console.error('  URL:', error.config?.url)
      console.error('  Base URL:', error.config?.baseURL)
      console.error('  Full URL:', error.config?.baseURL + error.config?.url)
      console.error('  Error Code:', error.code)
      console.error('  Error Message:', error.message)
    } else {
      console.error('API Error:', error.response?.status || error.code, error.config?.url)
    }
    
    // Provide better error messages for common issues
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      error.userMessage = `Network error: Cannot reach server at ${error.config?.baseURL}. Please check your connection and that the server is running.`
    } else if (error.response?.status === 401) {
      error.userMessage = 'Invalid email or password'
    } else if (error.response?.status === 0) {
      error.userMessage = `CORS error: The server may not be allowing requests from this origin. Check CORS configuration.`
    }
    
    return Promise.reject(error)
  }
)

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
    try {
      if (import.meta.env.DEV) {
        const fullUrl = `${api.defaults.baseURL}/auth/login`
        console.log('Login request details:', {
          baseURL: api.defaults.baseURL,
          endpoint: '/auth/login',
          fullUrl,
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
          origin: typeof window !== 'undefined' ? window.location.origin : 'N/A'
        })
      }
      
      const { data } = await api.post('/auth/login', { email, password })
      if (data.token) {
        localStorage.setItem('token', data.token)
        if (import.meta.env.DEV) console.log('Login successful, token saved')
      }
      return data
    } catch (error: unknown) {
      const axiosError = error as { code?: string; message?: string; response?: { status?: number; statusText?: string; data?: unknown }; config?: { url?: string; baseURL?: string; method?: string; headers?: unknown } }
      
      if (import.meta.env.DEV) {
        console.error('Login API error details:', {
          message: axiosError.message,
          code: axiosError.code,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
          config: {
            url: axiosError.config?.url,
            baseURL: axiosError.config?.baseURL,
            method: axiosError.config?.method,
            headers: axiosError.config?.headers
          },
          fullUrl: (axiosError.config?.baseURL || '') + (axiosError.config?.url || '')
        })
      }
      
      if (axiosError.code === 'ERR_NETWORK' || axiosError.message?.includes('Network Error') || axiosError.message?.includes('Failed to fetch')) {
        const errorMsg = `Cannot connect to server at ${api.defaults.baseURL}. ` +
          `Please check: 1) Backend is running, 2) You're on the same network, 3) Firewall allows port 5000`
        throw new Error(errorMsg)
      }
      throw error
    }
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
  
  updateProfile: async (updates: Partial<User>): Promise<User> => {
    const { data } = await api.put('/user/profile', updates)
    return data
  },
  
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/user/change-password', { currentPassword, newPassword })
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
  
  clockOut: async (clockOutTime?: string, breakMinutes?: number): Promise<TimeEntry> => {
    const { data } = await api.post('/time-entries/clock-out', { clockOutTime, breakMinutes })
    return data
  },
  
  getEntries: async (startDate?: string, endDate?: string): Promise<TimeEntry[]> => {
    const params: Record<string, string> = {}
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
  
  deleteAllEntries: async (): Promise<{ message: string; deletedCount: number }> => {
    const { data } = await api.delete('/time-entries/all')
    return data
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
  },
  
  exportEntries: async (startDate?: string, endDate?: string): Promise<Blob> => {
    const params: Record<string, string> = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/time-entries/export', {
      params,
      responseType: 'blob'
    })
    
    // Check if the blob is actually a JSON error response
    if (response.data.type === 'application/json' || response.headers['content-type']?.includes('application/json')) {
      const text = await response.data.text()
      const errorData = JSON.parse(text)
      throw new Error(errorData.error || 'Failed to export time entries')
    }
    
    return response.data
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
  getEstimate: async (startDate?: string, endDate?: string, params?: {
    hours?: number
    hourlyRate?: number
  }): Promise<PayCalculation & {
    hourlyRate: number
    hours?: number
    payPeriod?: PayPeriod
    weeklyBreakdown?: Array<PayCalculation & { weekNumber: number; start: string; end: string }>
  }> => {
    const queryParams: Record<string, string | number | undefined> = { ...params }
    if (startDate) queryParams.startDate = startDate
    if (endDate) queryParams.endDate = endDate
    const { data } = await api.get('/paycheck/estimate', { params: queryParams })
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


