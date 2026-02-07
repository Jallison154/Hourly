import express from 'express'
import { z } from 'zod'
import prisma from '../utils/prisma'
import { requireAdmin } from '../middleware/adminAuth'

const router = express.Router()

// Use Sunday–Saturday week to match the app (WeeklySummary / Clock page "Hours Left")
function getCurrentWorkWeek(): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToSunday = day === 0 ? 0 : day
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - daysToSunday)
  sunday.setHours(0, 0, 0, 0)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  saturday.setHours(23, 59, 59, 999)
  return { start: sunday, end: saturday }
}

function entryHoursInRange(
  clockIn: Date,
  clockOut: Date | null,
  totalBreakMinutes: number,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const start = clockIn < rangeStart ? rangeStart : clockIn
  const end = clockOut == null
    ? (new Date() > rangeEnd ? rangeEnd : new Date())
    : (clockOut > rangeEnd ? rangeEnd : clockOut)
  if (start >= end) return 0
  const minutes = (end.getTime() - start.getTime()) / (1000 * 60) - totalBreakMinutes
  return Math.max(0, minutes) / 60
}

// POST /api/admin/login - validate admin password, return success (client stores password as token)
const loginSchema = z.object({
  password: z.string().min(1)
})

router.post('/login', (req, res) => {
  try {
    const { password } = loginSchema.parse(req.body)
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      return res.status(503).json({ error: 'Admin access not configured' })
    }

    if (password !== adminPassword) {
      return res.status(401).json({ error: 'Invalid admin password' })
    }

    res.json({ success: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Password required' })
    }
    throw e
  }
})

// GET /api/admin/dashboard - list all users with clock status and current week hours (requires admin auth)
router.get('/dashboard', requireAdmin, async (_req, res) => {
  try {
    const { start: weekStart, end: weekEnd } = getCurrentWorkWeek()

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true
      },
      orderBy: { name: 'asc' }
    })

    const openEntries = await prisma.timeEntry.findMany({
      where: { clockOut: null },
      select: { userId: true, clockIn: true }
    })
    const openByUser = new Map(openEntries.map(e => [e.userId, e]))

    const entriesInWeek = await prisma.timeEntry.findMany({
      where: {
        clockIn: { lte: weekEnd }
      },
      select: {
        userId: true,
        clockIn: true,
        clockOut: true,
        totalBreakMinutes: true
      }
    })

    const weekHoursByUser = new Map<string, number>()
    for (const u of users) {
      weekHoursByUser.set(u.id, 0)
    }
    for (const e of entriesInWeek) {
      const effectiveOut = e.clockOut ?? (new Date() > weekEnd ? weekEnd : new Date())
      if (effectiveOut < weekStart) continue
      const hours = entryHoursInRange(e.clockIn, e.clockOut, e.totalBreakMinutes, weekStart, weekEnd)
      weekHoursByUser.set(e.userId, (weekHoursByUser.get(e.userId) ?? 0) + hours)
    }

    const HOURS_IN_WORK_WEEK = 40

    const rows = users.map(user => {
      const currentWeekHours = weekHoursByUser.get(user.id) ?? 0
      const open = openByUser.get(user.id)
      const hoursLeft = HOURS_IN_WORK_WEEK - currentWeekHours
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        isClockedIn: !!open,
        clockedInSince: open?.clockIn?.toISOString() ?? null,
        currentWeekHours: Math.round(currentWeekHours * 100) / 100,
        hoursLeft: Math.round(hoursLeft * 100) / 100
      }
    })

    res.json({
      workWeek: {
        start: weekStart.toISOString(),
        end: weekEnd.toISOString()
      },
      users: rows
    })
  } catch (error) {
    console.error('Admin dashboard error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
