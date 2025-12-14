#!/usr/bin/env tsx

/**
 * Password Reset Script
 * 
 * This script allows you to reset a user's password directly in the database.
 * Usage: npm run reset-password <email> <new-password>
 *    or: npx tsx reset-password.ts <email> <new-password>
 * 
 * Example: npm run reset-password user@example.com newpassword123
 */

import 'dotenv/config'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Try to find the database file
const possiblePaths = [
  path.join(__dirname, 'prisma', 'dev.db'),
  './prisma/dev.db',
  process.env.DATABASE_URL?.replace('file:', '') || ''
]

let dbPath = null
for (const db of possiblePaths) {
  if (db && existsSync(db)) {
    dbPath = db
    break
  }
}

if (dbPath) {
  process.env.DATABASE_URL = `file:${path.resolve(dbPath)}`
} else {
  // Default to relative path
  process.env.DATABASE_URL = 'file:./prisma/dev.db'
}

import prisma from './src/utils/prisma'

async function resetPassword(email: string, newPassword: string) {
  try {
    // Normalize email to lowercase and trim whitespace
    const normalizedEmail = email.toLowerCase().trim()
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (!user) {
      console.error(`❌ User with email "${normalizedEmail}" not found`)
      console.error(`   Searched for: "${normalizedEmail}"`)
      console.error(`   (Original input: "${email}")`)
      console.error(`\n   To see all users, run: npm run list-users`)
      process.exit(1)
    }

    // Validate password length
    if (newPassword.length < 6) {
      console.error('❌ Password must be at least 6 characters long')
      process.exit(1)
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { password: hashedPassword }
    })

    console.log(`✅ Password reset successfully for ${normalizedEmail}`)
    console.log(`   New password: ${newPassword}`)
  } catch (error) {
    console.error('❌ Error resetting password:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Get command line arguments
const args = process.argv.slice(2)

if (args.length !== 2) {
  console.error('Usage: npx ts-node reset-password.ts <email> <new-password>')
  console.error('Example: npx ts-node reset-password.ts user@example.com newpassword123')
  process.exit(1)
}

const [email, newPassword] = args

resetPassword(email, newPassword)

