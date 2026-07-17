import express from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { randomBytes, createHash } from 'crypto'
import prisma from '../utils/prisma'
import {
  authenticate,
  requireAdmin,
  requireManagerOrAdmin,
  AuthRequest,
  requireEmployeeAccess,
} from '../middleware/auth'
import { ROLES, ROLE_VALUES } from '../constants/roles'
import { writeAudit } from '../utils/audit'
import { getOrCreateDefaultCompany } from '../utils/company'

const router = express.Router()

const createEmployeeSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']).default('EMPLOYEE'),
  managerId: z.string().nullable().optional(),
  hourlyRate: z.number().min(0).optional(),
  temporaryPassword: z.string().min(10).optional(),
})

const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']).optional(),
  managerId: z.string().nullable().optional(),
  hourlyRate: z.number().min(0).optional(),
  overtimeRate: z.number().positive().optional(),
  overtimeThresholdHours: z.number().positive().optional(),
  timezone: z.string().max(64).nullable().optional(),
  payPeriodType: z.enum(['weekly', 'monthly']).optional(),
  payPeriodEndDay: z.number().int().min(1).max(31).optional(),
  isActive: z.boolean().optional(),
  mustResetPassword: z.boolean().optional(),
})

router.get('/', authenticate, requireManagerOrAdmin, async (req: AuthRequest, res) => {
  try {
    const auth = req.auth!
    const where =
      auth.role === ROLES.ADMIN
        ? { companyId: auth.companyId ?? undefined }
        : { managerId: auth.id, companyId: auth.companyId ?? undefined }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        managerId: true,
        hourlyRate: true,
        timezone: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })
    res.json({ users })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const data = createEmployeeSchema.parse(req.body)
    const company = await getOrCreateDefaultCompany()
    const email = data.email.toLowerCase().trim()

    if (await prisma.user.findUnique({ where: { email } })) {
      return res.status(400).json({ error: 'Unable to create account with that email' })
    }

    const tempPassword = data.temporaryPassword || randomBytes(9).toString('base64url') + 'Aa1!'
    const user = await prisma.user.create({
      data: {
        email,
        name: data.name,
        role: data.role,
        managerId: data.managerId ?? null,
        hourlyRate: data.hourlyRate ?? 0,
        companyId: req.auth?.companyId ?? company.id,
        password: await bcrypt.hash(tempPassword, 10),
        mustResetPassword: true,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        managerId: true,
        hourlyRate: true,
      },
    })

    await writeAudit({
      actor: req.auth,
      targetUserId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'user.create',
      newValues: { ...user },
      req,
    })

    res.status(201).json({
      user,
      temporaryPassword: data.temporaryPassword ? undefined : tempPassword,
      message: data.temporaryPassword
        ? 'Employee created'
        : 'Employee created. Share the temporary password securely; it is shown once.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const data = updateEmployeeSchema.parse(req.body)
    const targetId = req.params.id

    if (req.auth?.id === targetId && data.role && data.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Cannot demote your own administrator account' })
    }
    if (req.auth?.id === targetId && data.isActive === false) {
      return res.status(403).json({ error: 'Cannot deactivate your own administrator account' })
    }

    const existing = await prisma.user.findFirst({
      where: { id: targetId, companyId: req.auth?.companyId ?? undefined },
    })
    if (!existing) return res.status(403).json({ error: 'Forbidden' })

    if (data.role && existing.role === ROLES.ADMIN && data.role !== ROLES.ADMIN) {
      const otherAdmins = await prisma.user.count({
        where: {
          role: ROLES.ADMIN,
          isActive: true,
          id: { not: targetId },
          companyId: req.auth?.companyId ?? undefined,
        },
      })
      if (otherAdmins === 0) {
        return res.status(400).json({ error: 'Cannot demote the last active administrator' })
      }
    }
    if (data.isActive === false && existing.role === ROLES.ADMIN) {
      const otherAdmins = await prisma.user.count({
        where: {
          role: ROLES.ADMIN,
          isActive: true,
          id: { not: targetId },
          companyId: req.auth?.companyId ?? undefined,
        },
      })
      if (otherAdmins === 0) {
        return res.status(400).json({ error: 'Cannot deactivate the last active administrator' })
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: {
        ...data,
        email: data.email ? data.email.toLowerCase().trim() : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        managerId: true,
        hourlyRate: true,
        timezone: true,
        mustResetPassword: true,
      },
    })

    await writeAudit({
      actor: req.auth,
      targetUserId: updated.id,
      entityType: 'User',
      entityId: updated.id,
      action: 'user.update',
      previousValues: {
        name: existing.name,
        email: existing.email,
        role: existing.role,
        isActive: existing.isActive,
        managerId: existing.managerId,
        hourlyRate: existing.hourlyRate,
      },
      newValues: updated,
      req,
    })

    res.json({ user: updated })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors })
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Create invite link (copyable; no email required) */
router.post('/invite', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']).default('EMPLOYEE'),
    })
    const { email, role } = schema.parse(req.body)
    const company = await getOrCreateDefaultCompany()
    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.invitation.create({
      data: {
        email: email.toLowerCase().trim(),
        role,
        companyId: req.auth?.companyId ?? company.id,
        tokenHash,
        expiresAt,
        invitedById: req.auth?.id,
      },
    })

    await writeAudit({
      actor: req.auth,
      entityType: 'Invitation',
      action: 'invitation.create',
      newValues: { email: email.toLowerCase().trim(), role },
      req,
    })

    res.status(201).json({
      invitePath: `/register?invite=${token}`,
      expiresAt: expiresAt.toISOString(),
      message: 'Share this invite link securely. It can be used once.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', authenticate, requireManagerOrAdmin, async (req: AuthRequest, res) => {
  const ok = await requireEmployeeAccess(req, res, req.params.id)
  if (!ok) return
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      managerId: true,
      hourlyRate: true,
      overtimeRate: true,
      timezone: true,
      payPeriodType: true,
      payPeriodEndDay: true,
      createdAt: true,
    },
  })
  if (!user) return res.status(403).json({ error: 'Forbidden' })
  res.json({ user })
})

void ROLE_VALUES

export default router
