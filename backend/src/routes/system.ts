import express from 'express'
import { existsSync, readdirSync, statSync } from 'fs'
import path from 'path'
import prisma from '../utils/prisma'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'
import { getOrCreateDefaultCompany } from '../utils/company'
import { ROLES } from '../constants/roles'

const router = express.Router()
const APP_VERSION = '1.2.0'

router.get('/health/detailed', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    const company = await getOrCreateDefaultCompany()
    const activeUsers = await prisma.user.count({
      where: { isActive: true, companyId: req.auth?.companyId ?? undefined },
    })
    const inactiveUsers = await prisma.user.count({
      where: { isActive: false, companyId: req.auth?.companyId ?? undefined },
    })
    const openShifts = await prisma.timeEntry.count({ where: { clockOut: null } })
    const pendingTimesheets = await prisma.timesheet.count({ where: { status: 'SUBMITTED' } })

    const backupDir = path.resolve(process.cwd(), '..', 'backups')
    let lastBackup: string | null = null
    if (existsSync(backupDir)) {
      const files = readdirSync(backupDir)
        .filter((f) => f.startsWith('hourly-') && f.endsWith('.db'))
        .map((f) => ({ f, m: statSync(path.join(backupDir, f)).mtimeMs }))
        .sort((a, b) => b.m - a.m)
      lastBackup = files[0]?.f ?? null
    }

    res.json({
      appVersion: APP_VERSION,
      nodeEnv: process.env.NODE_ENV,
      database: { type: 'sqlite', ok: true },
      company: {
        id: company.id,
        name: company.name,
        timezone: company.timezone,
        maintenanceMode: company.maintenanceMode,
      },
      counts: {
        activeUsers,
        inactiveUsers,
        openShifts,
        pendingTimesheets,
        admins: await prisma.user.count({
          where: { role: ROLES.ADMIN, isActive: true, companyId: req.auth?.companyId ?? undefined },
        }),
      },
      backups: {
        directory: backupDir,
        lastSuccessfulFile: lastBackup,
      },
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
