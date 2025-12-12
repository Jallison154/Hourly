import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }
    
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('WARNING: JWT_SECRET not set in environment variables! Using default secret is insecure.')
      // In production, you might want to throw an error instead
    }
    
    const decoded = jwt.verify(token, jwtSecret || 'secret') as { userId: string }
    req.userId = decoded.userId
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}


