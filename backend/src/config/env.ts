import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const rawSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters (use: openssl rand -hex 32)'),
  ADMIN_PASSWORD: z.string().min(1).optional(),
  ADMIN_PASSWORD_HASH: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z.string().optional(),
})

const parsed = rawSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n')
  console.error('Invalid environment configuration:\n' + details)
  process.exit(1)
}

const data = parsed.data

if (!data.ADMIN_PASSWORD && !data.ADMIN_PASSWORD_HASH) {
  console.error(
    'Invalid environment configuration:\n' +
      '  - ADMIN_PASSWORD or ADMIN_PASSWORD_HASH is required'
  )
  process.exit(1)
}

const isProduction = data.NODE_ENV === 'production'

const allowedOrigins = (data.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

if (isProduction && allowedOrigins.length === 0) {
  console.error(
    'Invalid environment configuration:\n' +
      '  - ALLOWED_ORIGINS is required in production (comma-separated list of origins)'
  )
  process.exit(1)
}

/** Dev defaults when ALLOWED_ORIGINS is unset (never used in production). */
const defaultDevOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]

export const env = {
  DATABASE_URL: data.DATABASE_URL,
  JWT_SECRET: data.JWT_SECRET,
  ADMIN_PASSWORD: data.ADMIN_PASSWORD,
  ADMIN_PASSWORD_HASH: data.ADMIN_PASSWORD_HASH,
  PORT: data.PORT,
  HOST: data.HOST,
  NODE_ENV: data.NODE_ENV,
  isProduction,
  isDev: data.NODE_ENV === 'development',
  allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : defaultDevOrigins,
} as const

export type Env = typeof env
