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

import bcrypt from 'bcryptjs'
import prisma from './src/utils/prisma'

async function resetPassword(email: string, newPassword: string) {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.error(`❌ User with email "${email}" not found`)
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
      where: { email },
      data: { password: hashedPassword }
    })

    console.log(`✅ Password reset successfully for ${email}`)
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

