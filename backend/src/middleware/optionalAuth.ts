import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AuthRequest, loadAuthUser } from './auth'

/** Attach req.auth when a valid token is present; never reject. */
export async function optionalAuthenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return next()
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId?: string }
    if (!decoded.userId) return next()
    const auth = await loadAuthUser(decoded.userId)
    if (auth?.isActive) {
      req.userId = auth.id
      req.auth = auth
    }
  } catch {
    /* ignore invalid tokens for optional path */
  }
  next()
}
