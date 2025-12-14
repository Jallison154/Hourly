#!/usr/bin/env tsx

/**
 * Check Time Entries Script
 * 
 * This script checks time entries for a user.
 * Usage: npx tsx check-time-entries.ts <email>
 */

import 'dotenv/config'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'

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

async function checkTimeEntries(email: string) {
  try {
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim()
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        timeEntries: {
          orderBy: {
            clockIn: 'desc'
          },
          take: 10 // Get last 10 entries
        }
      }
    })

    if (!user) {
      console.error(`❌ User with email "${normalizedEmail}" not found`)
      process.exit(1)
    }

    // Get total count
    const totalCount = await prisma.timeEntry.count({
      where: { userId: user.id }
    })

    console.log(`\nUser: ${user.name} (${user.email})`)
    console.log(`Total Time Entries: ${totalCount}\n`)

    if (totalCount === 0) {
      console.log('⚠️  No time entries found for this user.')
    } else {
      console.log('Recent entries:')
      console.log('='.repeat(80))
      user.timeEntries.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.clockIn.toISOString()}`)
        if (entry.clockOut) {
          console.log(`   Clock Out: ${entry.clockOut.toISOString()}`)
        } else {
          console.log(`   Clock Out: (In Progress)`)
        }
        console.log(`   Hours: ${entry.totalBreakMinutes} min break`)
        if (entry.notes) {
          console.log(`   Notes: ${entry.notes}`)
        }
        console.log('-'.repeat(80))
      })
      
      if (totalCount > 10) {
        console.log(`\n... and ${totalCount - 10} more entries`)
      }
    }
  } catch (error) {
    console.error('❌ Error checking time entries:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Get command line arguments
const args = process.argv.slice(2)

if (args.length !== 1) {
  console.error('Usage: npx tsx check-time-entries.ts <email>')
  console.error('Example: npx tsx check-time-entries.ts user@example.com')
  process.exit(1)
}

const [email] = args

checkTimeEntries(email)

