import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { z } from 'zod'
import prisma from '../utils/prisma'

const router = express.Router()

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  hourlyRate: z.number().positive().optional(),
  overtimeRate: z.number().positive().optional(),
  timeRoundingInterval: z.number().int().min(1).max(60).optional(),
  profileImage: z.string().url().optional().nullable(),
  payPeriodType: z.enum(['weekly', 'monthly']).optional(),
  payPeriodEndDay: z.number().int().min(1).max(31).optional(),
  paycheckAdjustment: z.number().optional(),
  state: z.string().max(2).optional().nullable(),
  stateTaxRate: z.number().min(0).max(1).optional().nullable()
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
    
    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
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
        stateTaxRate: true
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

export default router


