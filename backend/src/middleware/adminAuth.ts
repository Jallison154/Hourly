import { Request, Response, NextFunction } from 'express'

const ADMIN_TOKEN_HEADER = 'x-admin-token'

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers[ADMIN_TOKEN_HEADER] as string || req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD is not set in environment')
    return res.status(503).json({ error: 'Admin access not configured' })
  }

  if (!token || token !== adminPassword) {
    return res.status(401).json({ error: 'Invalid admin password' })
  }

  next()
}
