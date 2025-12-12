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
app.use(cors({
  origin: true, // Allow all origins
  credentials: true
}))
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

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`)
  console.log(`Access from other devices: http://<your-server-ip>:${PORT}`)
})


