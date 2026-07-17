import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import prisma from '../utils/prisma'
import { ROLES, type Role, isRole, roleAtLeast } from '../constants/roles'

export interface AuthUser {
  id: string
  email: string
  role: Role
  companyId: string | null
  managerId: string | null
  isActive: boolean
}

export interface AuthRequest extends Request {
  userId?: string
  auth?: AuthUser
}

interface AccessTokenPayload {
  userId: string
  role?: string
  typ?: string
}

export function signAccessToken(user: { id: string; role: string }): string {
  return jwt.sign(
    { userId: user.id, role: user.role, typ: 'access' },
    env.JWT_SECRET,
    { expiresIn: '12h' }
  )
}

export async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      companyId: true,
      managerId: true,
      isActive: true,
    },
  })
  if (!user || !isRole(user.role)) return null
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    managerId: user.managerId,
    isActive: user.isActive,
  }
}

/** requireAuthenticatedUser — loads fresh role/isActive from DB */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload
    if (!decoded.userId || decoded.typ === 'admin_legacy') {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const auth = await loadAuthUser(decoded.userId)
    if (!auth) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    if (!auth.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' })
    }

    req.userId = auth.id
    req.auth = auth
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireRole(...allowed: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    if (!allowed.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

export const requireAdmin = requireRole(ROLES.ADMIN)

export const requireManagerOrAdmin = requireRole(ROLES.MANAGER, ROLES.ADMIN)

/** Target employee must be self, a direct report (manager), or any (admin). */
export async function requireEmployeeAccess(
  req: AuthRequest,
  res: Response,
  targetUserId: string
): Promise<boolean> {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' })
    return false
  }
  if (req.auth.id === targetUserId) return true
  if (req.auth.role === ROLES.ADMIN) {
    const target = await prisma.user.findFirst({
      where: { id: targetUserId, companyId: req.auth.companyId ?? undefined },
      select: { id: true },
    })
    if (!target) {
      res.status(403).json({ error: 'Forbidden' })
      return false
    }
    return true
  }
  if (req.auth.role === ROLES.MANAGER) {
    const report = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        managerId: req.auth.id,
        companyId: req.auth.companyId ?? undefined,
        isActive: true,
      },
      select: { id: true },
    })
    if (!report) {
      res.status(403).json({ error: 'Forbidden' })
      return false
    }
    return true
  }
  res.status(403).json({ error: 'Forbidden' })
  return false
}

export async function requireRecordOwnership(
  req: AuthRequest,
  res: Response,
  ownerUserId: string
): Promise<boolean> {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' })
    return false
  }
  if (req.auth.id === ownerUserId) return true
  // Managers/admins may edit when company settings allow — checked by callers
  if (roleAtLeast(req.auth.role, ROLES.MANAGER)) {
    return requireEmployeeAccess(req, res, ownerUserId)
  }
  res.status(403).json({ error: 'Forbidden' })
  return false
}

export { ROLES }
