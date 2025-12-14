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
    
    // Normalize email to lowercase and trim whitespace
    const normalizedEmail = email.toLowerCase().trim()
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Create user with normalized email
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
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
    console.log('Login attempt from:', req.headers.origin || req.ip)
    console.log('Login request headers:', {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    })
    
    const { email, password } = loginSchema.parse(req.body)
    // Normalize email to lowercase and trim whitespace
    const normalizedEmail = email.toLowerCase().trim()
    console.log('Login attempt for email:', normalizedEmail)
    
    // Find user (email is already normalized)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })
    
    if (!user) {
      console.log('Login failed: User not found for email:', email)
      return res.status(401).json({ error: 'No account found with this email address. Please check your email or register a new account.' })
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, user.password)
    
    if (!isValid) {
      console.log('Login failed: Invalid password for email:', email)
      return res.status(401).json({ error: 'Incorrect password. Please try again or use the password reset option.' })
    }
    
    console.log('Login successful for email:', email)
    
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

