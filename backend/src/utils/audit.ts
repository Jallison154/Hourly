import type { Request } from 'express'
import prisma from './prisma'
import type { AuthUser } from '../middleware/auth'

const REDACT_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'secret',
  'authorization',
  'ADMIN_PASSWORD',
  'JWT_SECRET',
])

function scrub(value: unknown): unknown {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(scrub)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k) || /password|secret|token|hash/i.test(k)) {
        out[k] = '[redacted]'
      } else {
        out[k] = scrub(v)
      }
    }
    return out
  }
  return value
}

export async function writeAudit(options: {
  actor?: AuthUser | null
  companyId?: string | null
  targetUserId?: string | null
  entityType: string
  entityId?: string | null
  action: string
  previousValues?: unknown
  newValues?: unknown
  reason?: string | null
  req?: Request
}) {
  const ip =
    (options.req?.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    options.req?.ip ||
    null
  const ua = options.req?.headers['user-agent']?.slice(0, 300) || null

  await prisma.auditLog.create({
    data: {
      actorUserId: options.actor?.id ?? null,
      actorRole: options.actor?.role ?? null,
      companyId: options.companyId ?? options.actor?.companyId ?? null,
      targetUserId: options.targetUserId ?? null,
      entityType: options.entityType,
      entityId: options.entityId ?? null,
      action: options.action,
      previousValues: options.previousValues
        ? JSON.stringify(scrub(options.previousValues))
        : null,
      newValues: options.newValues ? JSON.stringify(scrub(options.newValues)) : null,
      reason: options.reason ?? null,
      requestId: (options.req?.headers['x-request-id'] as string) || null,
      ipAddress: ip,
      userAgent: ua,
    },
  })
}
