import express from 'express'
import { z } from 'zod'
import prisma from '../utils/prisma'
import {
  authenticate,
  requireManagerOrAdmin,
  AuthRequest,
  requireEmployeeAccess,
} from '../middleware/auth'
import { writeAudit } from '../utils/audit'
import { getCompanyForUser } from '../utils/company'

const router = express.Router()

const STATUSES = ['OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED'] as const

async function getOrCreateTimesheet(userId: string, periodStart: Date, periodEnd: Date, companyId: string | null) {
  return prisma.timesheet.upsert({
    where: {
      userId_periodStart_periodEnd: { userId, periodStart, periodEnd },
    },
    create: {
      userId,
      companyId,
      periodStart,
      periodEnd,
      status: 'OPEN',
    },
    update: {},
  })
}

router.get('/current', authenticate, async (req: AuthRequest, res) => {
  try {
    const start = req.query.start ? new Date(String(req.query.start)) : null
    const end = req.query.end ? new Date(String(req.query.end)) : null
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'start and end query params required (ISO dates)' })
    }
    const sheet = await getOrCreateTimesheet(
      req.userId!,
      start,
      end,
      req.auth?.companyId ?? null
    )
    res.json({ timesheet: sheet })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/submit', authenticate, async (req: AuthRequest, res) => {
  try {
    const sheet = await prisma.timesheet.findUnique({ where: { id: req.params.id } })
    if (!sheet || sheet.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (sheet.status !== 'OPEN' && sheet.status !== 'REJECTED') {
      return res.status(400).json({ error: `Cannot submit timesheet in status ${sheet.status}` })
    }
    const company = await getCompanyForUser(req.auth?.companyId)
    const updated = await prisma.timesheet.update({
      where: { id: sheet.id },
      data: {
        status: company.requireTimesheetApproval ? 'SUBMITTED' : 'APPROVED',
        submittedAt: new Date(),
        submittedById: req.userId,
        approvedAt: company.requireTimesheetApproval ? null : new Date(),
        approvedById: company.requireTimesheetApproval ? null : req.userId,
        rejectionReason: null,
      },
    })
    await writeAudit({
      actor: req.auth,
      targetUserId: sheet.userId,
      entityType: 'Timesheet',
      entityId: sheet.id,
      action: 'timesheet.submit',
      previousValues: { status: sheet.status },
      newValues: { status: updated.status },
      req,
    })
    res.json({ timesheet: updated })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/withdraw', authenticate, async (req: AuthRequest, res) => {
  try {
    const sheet = await prisma.timesheet.findUnique({ where: { id: req.params.id } })
    if (!sheet || sheet.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (sheet.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Only submitted timesheets can be withdrawn' })
    }
    const updated = await prisma.timesheet.update({
      where: { id: sheet.id },
      data: { status: 'OPEN', submittedAt: null, submittedById: null },
    })
    await writeAudit({
      actor: req.auth,
      targetUserId: sheet.userId,
      entityType: 'Timesheet',
      entityId: sheet.id,
      action: 'timesheet.withdraw',
      previousValues: { status: 'SUBMITTED' },
      newValues: { status: 'OPEN' },
      req,
    })
    res.json({ timesheet: updated })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/approve', authenticate, requireManagerOrAdmin, async (req: AuthRequest, res) => {
  try {
    const sheet = await prisma.timesheet.findUnique({ where: { id: req.params.id } })
    if (!sheet) return res.status(403).json({ error: 'Forbidden' })
    const ok = await requireEmployeeAccess(req, res, sheet.userId)
    if (!ok) return
    if (sheet.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Only submitted timesheets can be approved' })
    }
    const updated = await prisma.timesheet.update({
      where: { id: sheet.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: req.userId,
      },
    })
    await writeAudit({
      actor: req.auth,
      targetUserId: sheet.userId,
      entityType: 'Timesheet',
      entityId: sheet.id,
      action: 'timesheet.approve',
      previousValues: { status: sheet.status },
      newValues: { status: 'APPROVED' },
      req,
    })
    res.json({ timesheet: updated })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/reject', authenticate, requireManagerOrAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ reason: z.string().min(3).max(1000) })
    const { reason } = schema.parse(req.body)
    const sheet = await prisma.timesheet.findUnique({ where: { id: req.params.id } })
    if (!sheet) return res.status(403).json({ error: 'Forbidden' })
    const ok = await requireEmployeeAccess(req, res, sheet.userId)
    if (!ok) return
    if (sheet.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Only submitted timesheets can be rejected' })
    }
    const updated = await prisma.timesheet.update({
      where: { id: sheet.id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedById: req.userId,
        rejectionReason: reason,
      },
    })
    await writeAudit({
      actor: req.auth,
      targetUserId: sheet.userId,
      entityType: 'Timesheet',
      entityId: sheet.id,
      action: 'timesheet.reject',
      previousValues: { status: sheet.status },
      newValues: { status: 'REJECTED', rejectionReason: reason },
      reason,
      req,
    })
    res.json({ timesheet: updated })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/lock', authenticate, requireManagerOrAdmin, async (req: AuthRequest, res) => {
  try {
    const sheet = await prisma.timesheet.findUnique({ where: { id: req.params.id } })
    if (!sheet) return res.status(403).json({ error: 'Forbidden' })
    if (req.auth?.role !== 'ADMIN') {
      const ok = await requireEmployeeAccess(req, res, sheet.userId)
      if (!ok) return
    }
    if (sheet.status !== 'APPROVED' && sheet.status !== 'LOCKED') {
      return res.status(400).json({ error: 'Only approved timesheets can be locked' })
    }
    const updated = await prisma.timesheet.update({
      where: { id: sheet.id },
      data: { status: 'LOCKED', lockedAt: new Date(), lockedById: req.userId },
    })
    await writeAudit({
      actor: req.auth,
      targetUserId: sheet.userId,
      entityType: 'Timesheet',
      entityId: sheet.id,
      action: 'timesheet.lock',
      previousValues: { status: sheet.status },
      newValues: { status: 'LOCKED' },
      req,
    })
    res.json({ timesheet: updated })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/reopen', authenticate, requireManagerOrAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ reason: z.string().min(3).max(1000) })
    const { reason } = schema.parse(req.body)
    if (req.auth?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can reopen locked timesheets' })
    }
    const sheet = await prisma.timesheet.findUnique({ where: { id: req.params.id } })
    if (!sheet) return res.status(403).json({ error: 'Forbidden' })
    if (sheet.status !== 'LOCKED' && sheet.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Timesheet is not locked/approved' })
    }
    const updated = await prisma.timesheet.update({
      where: { id: sheet.id },
      data: {
        status: 'OPEN',
        lockedAt: null,
        lockedById: null,
        approvedAt: null,
        approvedById: null,
      },
    })
    await writeAudit({
      actor: req.auth,
      targetUserId: sheet.userId,
      entityType: 'Timesheet',
      entityId: sheet.id,
      action: 'timesheet.reopen',
      previousValues: { status: sheet.status },
      newValues: { status: 'OPEN' },
      reason,
      req,
    })
    res.json({ timesheet: updated })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors })
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Correction requests */
router.post('/corrections', authenticate, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      timeEntryId: z.string().optional(),
      timesheetId: z.string().optional(),
      requestedChange: z.string().min(3).max(2000),
      reason: z.string().min(3).max(2000),
    })
    const data = schema.parse(req.body)
    const created = await prisma.correctionRequest.create({
      data: {
        employeeId: req.userId!,
        companyId: req.auth?.companyId,
        timeEntryId: data.timeEntryId,
        timesheetId: data.timesheetId,
        requestedChange: data.requestedChange,
        reason: data.reason,
        status: 'PENDING',
      },
    })
    await writeAudit({
      actor: req.auth,
      targetUserId: req.userId,
      entityType: 'CorrectionRequest',
      entityId: created.id,
      action: 'correction.create',
      newValues: data,
      req,
    })
    res.status(201).json({ correction: created })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/corrections', authenticate, async (req: AuthRequest, res) => {
  const where =
    req.auth?.role === 'EMPLOYEE'
      ? { employeeId: req.userId! }
      : req.auth?.role === 'MANAGER'
        ? { employee: { managerId: req.userId! } }
        : { companyId: req.auth?.companyId ?? undefined }

  const corrections = await prisma.correctionRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json({ corrections })
})

void STATUSES

export default router
