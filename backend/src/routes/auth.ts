import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../utils/prisma'

const router = express.Router()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  hourlyRate: z.number().positive().optional()
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, hourlyRate } = registerSchema.parse(req.body)
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        hourlyRate: hourlyRate || 0
      }
    })
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    )
    
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        hourlyRate: user.hourlyRate
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Register error:', error)
    if (error instanceof Error && error.message.includes('connect')) {
      return res.status(500).json({ 
        error: 'Database connection failed. Please check your DATABASE_URL in .env file and ensure PostgreSQL is running.' 
      })
    }
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    })
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, user.password)
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    )
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        hourlyRate: user.hourlyRate
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Login error:', error)
    if (error instanceof Error && error.message.includes('connect')) {
      return res.status(500).json({ 
        error: 'Database connection failed. Please check your DATABASE_URL in .env file and ensure PostgreSQL is running.' 
      })
    }
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' })
  }
})

export default router

