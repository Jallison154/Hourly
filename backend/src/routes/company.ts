import express from 'express'
import { z } from 'zod'
import prisma from '../utils/prisma'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'
import { getOrCreateDefaultCompany, getCompanyForUser } from '../utils/company'
import { writeAudit } from '../utils/audit'

const router = express.Router()

const settingsSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  logoUrl: z.string().url().nullable().optional(),
  timezone: z.string().min(1).max(64).optional(),
  workWeekStartDay: z.number().int().min(0).max(6).optional(),
  overtimeThresholdMinutes: z.number().int().min(60).max(10080).optional(),
  overtimeMultiplier: z.number().min(1).max(3).optional(),
  defaultPayPeriodType: z.enum(['weekly', 'monthly']).optional(),
  payPeriodEndDay: z.number().int().min(1).max(31).optional(),
  longShiftWarningMinutes: z.number().int().min(60).max(10080).optional(),
  allowEmployeeManualEntries: z.boolean().optional(),
  allowEmployeeEditing: z.boolean().optional(),
  requireTimesheetApproval: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),
  paycheckEstimatesEnabled: z.boolean().optional(),
  taxEstimatesEnabled: z.boolean().optional(),
  scheduleEnabled: z.boolean().optional(),
  importEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).nullable().optional(),
})

router.get('/settings', authenticate, async (req: AuthRequest, res) => {
  try {
    const company = await getCompanyForUser(req.auth?.companyId)
    res.json({ company })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/settings', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const data = settingsSchema.parse(req.body)
    const company = await getOrCreateDefaultCompany()
    const previous = { ...company }

    const updated = await prisma.company.update({
      where: { id: company.id },
      data,
    })

    await writeAudit({
      actor: req.auth,
      companyId: updated.id,
      entityType: 'Company',
      entityId: updated.id,
      action: 'company.settings_update',
      previousValues: previous,
      newValues: updated,
      reason:
        data.overtimeThresholdMinutes !== undefined ||
        data.overtimeMultiplier !== undefined ||
        data.workWeekStartDay !== undefined
          ? 'Calculation-related settings changed; applies to future calculations and open periods. Locked timesheets are not recalculated.'
          : null,
      req,
    })

    res.json({
      company: updated,
      warning:
        data.overtimeThresholdMinutes !== undefined ||
        data.workWeekStartDay !== undefined ||
        data.overtimeMultiplier !== undefined
          ? 'Overtime/workweek changes apply to future calculations. Locked historical payroll is not silently recalculated.'
          : undefined,
    })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
