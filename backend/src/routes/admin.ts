import express from 'express'
import prisma from '../utils/prisma'
import { authenticate, requireAdmin, requireManagerOrAdmin, AuthRequest, requireEmployeeAccess } from '../middleware/auth'
import { ROLES } from '../constants/roles'
import { workedHoursInRange } from '../utils/workedTime'

const router = express.Router()

function getCurrentWorkWeek(workweekStartDay = 0): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay()
  const startDay = ((workweekStartDay % 7) + 7) % 7
  const delta = (day - startDay + 7) % 7
  const start = new Date(now)
  start.setDate(now.getDate() - delta)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** GET /api/admin/dashboard — managers see reports; admins see company */
router.get(
  '/dashboard',
  authenticate,
  requireManagerOrAdmin,
  async (req: AuthRequest, res) => {
    try {
      const auth = req.auth!
      const { start: weekStart, end: weekEnd } = getCurrentWorkWeek(0)

      const userWhere =
        auth.role === ROLES.ADMIN
          ? { companyId: auth.companyId ?? undefined }
          : { managerId: auth.id, companyId: auth.companyId ?? undefined }

      const users = await prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          managerId: true,
          overtimeThresholdHours: true,
        },
        orderBy: { name: 'asc' },
      })

      const userIds = users.map((u) => u.id)

      const openEntries = await prisma.timeEntry.findMany({
        where: { userId: { in: userIds }, clockOut: null },
        select: {
          userId: true,
          clockIn: true,
          breaks: {
            where: { endTime: null },
            select: { id: true, startTime: true, breakType: true },
          },
        },
      })
      const openByUser = new Map(openEntries.map((e) => [e.userId, e]))

      const entriesInWeek = await prisma.timeEntry.findMany({
        where: {
          userId: { in: userIds },
          clockIn: { gte: weekStart, lte: weekEnd },
        },
        select: {
          userId: true,
          clockIn: true,
          clockOut: true,
          totalBreakMinutes: true,
          breaks: { select: { startTime: true, endTime: true } },
        },
      })

      const weekHoursByUser = new Map<string, number>()
      for (const u of users) weekHoursByUser.set(u.id, 0)
      for (const e of entriesInWeek) {
        const hours = workedHoursInRange({
          clockIn: e.clockIn,
          clockOut: e.clockOut,
          rangeStart: weekStart,
          rangeEnd: weekEnd,
          breaks: e.breaks,
          totalBreakMinutes: e.totalBreakMinutes,
        })
        weekHoursByUser.set(e.userId, (weekHoursByUser.get(e.userId) ?? 0) + hours)
      }

      const pendingTimesheets = await prisma.timesheet.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          status: 'SUBMITTED',
        },
        _count: true,
      })
      const pendingByUser = new Map(pendingTimesheets.map((t) => [t.userId, t._count]))

      const rows = users.map((user) => {
        const currentWeekHours = weekHoursByUser.get(user.id) ?? 0
        const open = openByUser.get(user.id)
        const threshold = user.overtimeThresholdHours || 40
        const hoursLeft = threshold - currentWeekHours
        const openHours = open?.clockIn
          ? (Date.now() - new Date(open.clockIn).getTime()) / (1000 * 60 * 60)
          : 0
        const activeBreak = open?.breaks?.[0] ?? null
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          managerId: user.managerId,
          isClockedIn: !!open,
          clockedInSince: open?.clockIn?.toISOString() ?? null,
          onBreak: !!activeBreak,
          activeBreakType: activeBreak?.breakType ?? null,
          currentWeekHours: Math.round(currentWeekHours * 100) / 100,
          overtimeHours: Math.max(0, Math.round((currentWeekHours - threshold) * 100) / 100),
          hoursLeft: Math.round(hoursLeft * 100) / 100,
          unusuallyLongShift: openHours >= 12,
          openShiftHours: open ? Math.round(openHours * 100) / 100 : null,
          pendingTimesheets: pendingByUser.get(user.id) ?? 0,
        }
      })

      res.json({
        workWeek: {
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
        },
        summary: {
          clockedIn: rows.filter((r) => r.isClockedIn).length,
          onBreak: rows.filter((r) => r.onBreak).length,
          missingClockOut: rows.filter((r) => r.unusuallyLongShift).length,
          inOvertime: rows.filter((r) => r.overtimeHours > 0).length,
          awaitingApproval: rows.reduce((s, r) => s + r.pendingTimesheets, 0),
        },
        users: rows,
      })
    } catch (error) {
      console.error('Admin dashboard error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

router.get('/audit', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { companyId: req.auth?.companyId ?? undefined },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    res.json({
      logs: logs.map((l) => ({
        ...l,
        previousValues: l.previousValues ? JSON.parse(l.previousValues) : null,
        newValues: l.newValues ? JSON.parse(l.newValues) : null,
        createdAt: l.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Admin audit error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Convenience: verify manager can access employee (for future detail routes) */
router.get(
  '/employees/:id/access-check',
  authenticate,
  requireManagerOrAdmin,
  async (req: AuthRequest, res) => {
    const ok = await requireEmployeeAccess(req, res, req.params.id)
    if (!ok) return
    res.json({ ok: true })
  }
)

export default router
