import express from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import prisma from '../utils/prisma'
import { env } from '../config/env'
import { authRateLimiter } from '../middleware/rateLimit'
import { signAccessToken, authenticate, AuthRequest } from '../middleware/auth'
import { ROLES } from '../constants/roles'
import { getOrCreateDefaultCompany } from '../utils/company'
import { writeAudit } from '../utils/audit'
import { verifyAdminPassword } from '../utils/adminPassword'

const router = express.Router()

const MIN_PASSWORD_LENGTH = 10

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  name: z.string().min(1),
  hourlyRate: z.number().positive().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function publicUser(user: {
  id: string
  email: string
  name: string
  hourlyRate: number
  role: string
  isActive: boolean
  companyId: string | null
  managerId: string | null
  mustResetPassword?: boolean
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    hourlyRate: user.hourlyRate,
    role: user.role,
    isActive: user.isActive,
    companyId: user.companyId,
    managerId: user.managerId,
    mustResetPassword: user.mustResetPassword ?? false,
  }
}

router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const company = await getOrCreateDefaultCompany()
    if (!company.registrationEnabled) {
      return res.status(403).json({ error: 'Registration is disabled. Ask an administrator for an invite.' })
    }

    const { email, password, name, hourlyRate } = registerSchema.parse(req.body)
    const normalizedEmail = email.toLowerCase().trim()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })
    if (existingUser) {
      // Generic message — do not confirm account existence precisely in production UX
      return res.status(400).json({ error: 'Unable to create account with that email' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name,
        hourlyRate: hourlyRate || 0,
        role: ROLES.EMPLOYEE,
        companyId: company.id,
        isActive: true,
      },
    })

    const token = signAccessToken(user)
    res.status(201).json({ token, user: publicUser(user) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    if (!env.isProduction) {
      console.error('Register error:', error instanceof Error ? error.message : 'Unknown')
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const normalizedEmail = email.toLowerCase().trim()

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    const hash = user?.password ?? '$2a$10$invalidhashinvalidhashinvalidhashinvalidhashuu'
    const isValid = user ? await bcrypt.compare(password, hash) : false

    if (!user || !isValid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    if (!user.isActive) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = signAccessToken(user)
    res.json({ token, user: publicUser(user) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Logout is client-side token discard; endpoint exists for audit/symmetry. */
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  await writeAudit({
    actor: req.auth,
    action: 'auth.logout',
    entityType: 'User',
    entityId: req.auth?.id,
    req,
  })
  res.json({ success: true })
})

/**
 * One-time bootstrap: promote an existing user to ADMIN using legacy ADMIN_PASSWORD.
 * Disabled once at least one ADMIN exists (unless FORCE_ADMIN_BOOTSTRAP=true).
 */
router.post('/bootstrap-admin', authRateLimiter, async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      adminPassword: z.string().min(1),
    })
    const { email, adminPassword } = schema.parse(req.body)

    const adminCount = await prisma.user.count({ where: { role: ROLES.ADMIN, isActive: true } })
    if (adminCount > 0 && process.env.FORCE_ADMIN_BOOTSTRAP !== 'true') {
      return res.status(403).json({
        error: 'An administrator already exists. Use an ADMIN account or set FORCE_ADMIN_BOOTSTRAP=true.',
      })
    }

    const ok = await verifyAdminPassword(adminPassword)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const company = await getOrCreateDefaultCompany()
    const normalizedEmail = email.toLowerCase().trim()
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user) {
      return res.status(404).json({ error: 'User not found. Register the account first, then bootstrap.' })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: ROLES.ADMIN, companyId: user.companyId ?? company.id, isActive: true },
    })

    await writeAudit({
      actor: null,
      companyId: company.id,
      targetUserId: updated.id,
      entityType: 'User',
      entityId: updated.id,
      action: 'user.role_bootstrap_admin',
      previousValues: { role: user.role },
      newValues: { role: ROLES.ADMIN },
      reason: 'Legacy ADMIN_PASSWORD bootstrap',
      req,
    })

    const token = signAccessToken(updated)
    res.json({
      success: true,
      token,
      user: publicUser(updated),
      message: 'User promoted to ADMIN. Prefer logging in with this account; retire ADMIN_PASSWORD when ready.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
