import express from 'express'
import bcrypt from 'bcryptjs'
import { authenticate, AuthRequest } from '../middleware/auth'
import { z } from 'zod'
import prisma from '../utils/prisma'

const router = express.Router()

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  hourlyRate: z.number().positive().optional(),
  overtimeRate: z.number().positive().optional(),
  timeRoundingInterval: z.number().int().min(1).max(60).optional(),
  profileImage: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  payPeriodType: z.enum(['weekly', 'monthly']).optional(),
  payPeriodEndDay: z.number().int().min(1).max(31).optional(),
  paycheckAdjustment: z.number().optional(),
  state: z.union([z.string().max(2), z.literal('')]).optional().nullable(),
  stateTaxRate: z.number().min(0).max(1).optional().nullable(),
  filingStatus: z.enum(['single', 'married']).optional(),
  weeklySchedule: z.string().optional().nullable() // JSON string
})

// Get user profile
router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        hourlyRate: true,
        overtimeRate: true,
        timeRoundingInterval: true,
        profileImage: true,
        payPeriodType: true,
        payPeriodEndDay: true,
        paycheckAdjustment: true,
        state: true,
        stateTaxRate: true,
        filingStatus: true,
        weeklySchedule: true,
        createdAt: true
      }
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    res.json(user)
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update user profile
router.put('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = updateProfileSchema.parse(req.body)
    
    // Normalize empty strings to null for nullable fields
    const normalizedData: any = { ...data }
    if (normalizedData.profileImage === '') {
      normalizedData.profileImage = null
    }
    if (normalizedData.state === '') {
      normalizedData.state = null
    }
    
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: normalizedData,
      select: {
        id: true,
        email: true,
        name: true,
        hourlyRate: true,
        overtimeRate: true,
        timeRoundingInterval: true,
        profileImage: true,
        payPeriodType: true,
        payPeriodEndDay: true,
        paycheckAdjustment: true,
        state: true,
        stateTaxRate: true,
        filingStatus: true,
        weeklySchedule: true
      }
    })
    
    res.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Update profile error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
})

// Change password
router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body)
    
    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, password: true }
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    // Update password
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword }
    })
    
    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Change password error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const weeklyScheduleSchema = z.object({
  monday: z.number().min(0).max(24).optional(),
  tuesday: z.number().min(0).max(24).optional(),
  wednesday: z.number().min(0).max(24).optional(),
  thursday: z.number().min(0).max(24).optional(),
  friday: z.number().min(0).max(24).optional(),
  saturday: z.number().min(0).max(24).optional(),
  sunday: z.number().min(0).max(24).optional()
})

// Get weekly schedule
router.get('/schedule', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { weeklySchedule: true }
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Parse JSON schedule or return default
    let schedule = {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0
    }
    
    if (user.weeklySchedule) {
      try {
        schedule = { ...schedule, ...JSON.parse(user.weeklySchedule) }
      } catch (e) {
        console.error('Error parsing weekly schedule:', e)
      }
    }
    
    res.json(schedule)
  } catch (error) {
    console.error('Get schedule error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update weekly schedule
router.put('/schedule', authenticate, async (req: AuthRequest, res) => {
  try {
    const schedule = weeklyScheduleSchema.parse(req.body)
    
    // Convert to JSON string
    const scheduleJson = JSON.stringify(schedule)
    
    await prisma.user.update({
      where: { id: req.userId },
      data: { weeklySchedule: scheduleJson }
    })
    
    res.json(schedule)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Update schedule error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router


