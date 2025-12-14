#!/usr/bin/env tsx

/**
 * List Users Script
 * 
 * This script lists all users in the database.
 * Usage: npm run list-users
 *    or: npx tsx list-users.ts
 */

// Set DATABASE_URL to relative path before loading env
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db'

import 'dotenv/config'

// Override with relative path if absolute path doesn't work
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
  const dbUrl = process.env.DATABASE_URL.replace('file:', '')
  // If it's an absolute path that might be wrong, use relative instead
  if (dbUrl.includes('Documents/Local Projects') && !dbUrl.includes("Jonathan's MacBook Pro")) {
    process.env.DATABASE_URL = 'file:./prisma/dev.db'
  }
}

import prisma from './src/utils/prisma'

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        hourlyRate: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (users.length === 0) {
      console.log('No users found in the database.')
      return
    }

    console.log(`\nFound ${users.length} user(s):\n`)
    console.log('='.repeat(80))
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`)
      console.log(`   Name: ${user.name}`)
      console.log(`   Hourly Rate: $${user.hourlyRate}/hr`)
      console.log(`   Created: ${user.createdAt.toISOString()}`)
      console.log(`   ID: ${user.id}`)
      console.log('-'.repeat(80))
    })
  } catch (error) {
    console.error('❌ Error listing users:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

listUsers()

