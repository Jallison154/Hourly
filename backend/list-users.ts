#!/usr/bin/env tsx

/**
 * List Users Script
 * 
 * This script lists all users in the database.
 * Usage: npm run list-users
 *    or: npx tsx list-users.ts
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

