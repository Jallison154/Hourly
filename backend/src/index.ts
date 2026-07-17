import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env'
import authRoutes from './routes/auth'
import userRoutes from './routes/user'
import timeEntryRoutes from './routes/timeEntries'
import timesheetRoutes from './routes/timesheet'
import timesheetsWorkflowRoutes from './routes/timesheets'
import paycheckRoutes from './routes/paycheck'
import metricsRoutes from './routes/metrics'
import importRoutes from './routes/import'
import adminRoutes from './routes/admin'
import employeesRoutes from './routes/employees'
import companyRoutes from './routes/company'
import systemRoutes from './routes/system'
import { maintenanceGuard } from './middleware/maintenance'
import { optionalAuthenticate } from './middleware/optionalAuth'
import { AuthRequest } from './middleware/auth'

const app = express()

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
)

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (env.allowedOrigins.includes(origin)) return callback(null, true)
    if (env.isDev) {
      try {
        const url = new URL(origin)
        if (
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1' ||
          /^192\.168\.\d+\.\d+$/.test(url.hostname) ||
          /^10\.\d+\.\d+\.\d+$/.test(url.hostname)
        ) {
          return callback(null, true)
        }
      } catch {
        /* fall through */
      }
    }
    return callback(new Error(`Origin not allowed by CORS: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Admin-Token',
    'Idempotency-Key',
    'X-Request-Id',
  ],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use(optionalAuthenticate)
app.use((req, res, next) => maintenanceGuard(req as AuthRequest, res, next))

app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/time-entries', timeEntryRoutes)
app.use('/api/timesheet', timesheetRoutes)
app.use('/api/timesheets', timesheetsWorkflowRoutes)
app.use('/api/paycheck', paycheckRoutes)
app.use('/api/metrics', metricsRoutes)
app.use('/api/import', importRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/employees', employeesRoutes)
app.use('/api/company', companyRoutes)
app.use('/api/system', systemRoutes)

app.get('/api/test', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend is reachable', timestamp: new Date().toISOString() })
})

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (err.message?.startsWith('Origin not allowed')) {
      return res.status(403).json({ error: 'Origin not allowed' })
    }
    if (!env.isProduction) console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
)

app.listen(env.PORT, env.HOST, () => {
  console.log(`Server running on ${env.HOST}:${env.PORT} (${env.NODE_ENV})`)
})
