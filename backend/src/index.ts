import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import userRoutes from './routes/user'
import timeEntryRoutes from './routes/timeEntries'
import timesheetRoutes from './routes/timesheet'
import paycheckRoutes from './routes/paycheck'
import metricsRoutes from './routes/metrics'
import importRoutes from './routes/import'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const HOST = process.env.HOST || '0.0.0.0' // Listen on all interfaces to allow mobile access

// CORS configuration - allow requests from any origin (for mobile access)
// Safari requires explicit origin handling, not just 'true'
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    // Allow all origins for development/mobile access
    // Safari requires explicit origin matching, so we allow all
    callback(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}

app.use(cors(corsOptions))

// Handle preflight requests explicitly - Safari requires this
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '10mb' })) // Increase limit for CSV imports

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/time-entries', timeEntryRoutes)
app.use('/api/timesheet', timesheetRoutes)
app.use('/api/paycheck', paycheckRoutes)
app.use('/api/metrics', metricsRoutes)
app.use('/api/import', importRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Test endpoint for connectivity
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Backend is reachable',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin || 'unknown'
  })
})

const port = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT
app.listen(port, HOST, () => {
  console.log(`Server running on ${HOST}:${port}`)
  console.log(`Access from other devices: http://<your-server-ip>:${port}`)
})


