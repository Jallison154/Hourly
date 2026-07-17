import { timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'
import { env } from '../config/env'

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // Compare against self to keep roughly constant work when lengths differ
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

/** Validate admin password against ADMIN_PASSWORD_HASH or ADMIN_PASSWORD. */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (env.ADMIN_PASSWORD_HASH) {
    return bcrypt.compare(password, env.ADMIN_PASSWORD_HASH)
  }
  if (env.ADMIN_PASSWORD) {
    return safeEqualString(password, env.ADMIN_PASSWORD)
  }
  return false
}
