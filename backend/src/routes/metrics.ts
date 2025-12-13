import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import prisma from '../utils/prisma'
import { getCurrentPayPeriod } from '../utils/payPeriod'
import { calculatePayForEntries } from '../utils/payCalculator'

const router = express.Router()

// Get dashboard metrics
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { 
        id: true,
        hourlyRate: true,
        overtimeRate: true,
        payPeriodType: true,
        payPeriodEndDay: true,
        state: true,
        stateTaxRate: true
      }
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    const payPeriod = getCurrentPayPeriod(
      new Date(),
      user?.payPeriodType || 'monthly',
      user?.payPeriodEndDay || 10
    )
    
    // Get entries for current pay period
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: req.userId!,
        clockIn: {
          gte: payPeriod.start,
          lte: payPeriod.end
        }
      }
    })
    
    // Calculate totals
    let totalHours = 0
    let completedEntries = 0
    const dailyHours: { [key: string]: number } = {}
    
    entries.forEach(entry => {
      if (entry.clockOut) {
        const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
        const breakHours = entry.totalBreakMinutes / 60
        const workedHours = hours - breakHours
        
        totalHours += workedHours
        completedEntries++
        
        // Group by date
        const dateKey = entry.clockIn.toISOString().split('T')[0]
        dailyHours[dateKey] = (dailyHours[dateKey] || 0) + workedHours
      }
    })
    
    // Calculate pay
    const completed = entries.filter(e => e.clockOut !== null)
    const payCalculation = calculatePayForEntries(
      completed.map(e => ({
        clockIn: e.clockIn,
        clockOut: e.clockOut!,
        totalBreakMinutes: e.totalBreakMinutes
      })),
      user.hourlyRate || 0,
      user.overtimeRate || 1.5,
      user.state,
      user.stateTaxRate
    )
    
    // Get average hours per day
    const daysWorked = Object.keys(dailyHours).length
    const avgHoursPerDay = daysWorked > 0 ? totalHours / daysWorked : 0
    
    // Get clock in/out patterns
    const clockInTimes = entries.map(e => {
      const hour = e.clockIn.getHours()
      const minute = e.clockIn.getMinutes()
      return hour * 60 + minute // minutes since midnight
    })
    
    const clockOutTimes = entries
      .filter(e => e.clockOut)
      .map(e => {
        const hour = e.clockOut!.getHours()
        const minute = e.clockOut!.getMinutes()
        return hour * 60 + minute
      })
    
    const avgClockIn = clockInTimes.length > 0
      ? clockInTimes.reduce((a, b) => a + b, 0) / clockInTimes.length
      : 0
    
    const avgClockOut = clockOutTimes.length > 0
      ? clockOutTimes.reduce((a, b) => a + b, 0) / clockOutTimes.length
      : 0
    
    // Get entries from last 30 days for trends
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentEntries = await prisma.timeEntry.findMany({
      where: {
        userId: req.userId!,
        clockIn: {
          gte: thirtyDaysAgo
        },
        clockOut: { not: null }
      }
    })
    
    const recentHours = recentEntries.reduce((total, entry) => {
      if (!entry.clockOut) return total
      const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60)
      const breakHours = entry.totalBreakMinutes / 60
      return total + (hours - breakHours)
    }, 0)
    
    res.json({
      payPeriod,
      currentPeriod: {
        totalHours,
        completedEntries,
        avgHoursPerDay,
        daysWorked,
        ...payCalculation
      },
      patterns: {
        avgClockIn: avgClockIn > 0 ? {
          hour: Math.floor(avgClockIn / 60),
          minute: Math.round(avgClockIn % 60)
        } : null,
        avgClockOut: avgClockOut > 0 ? {
          hour: Math.floor(avgClockOut / 60),
          minute: Math.round(avgClockOut % 60)
        } : null
      },
      dailyHours,
      recentActivity: {
        last30DaysHours: recentHours,
        last30DaysEntries: recentEntries.length
      }
    })
  } catch (error) {
    console.error('Get metrics error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router


