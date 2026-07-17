import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { ROLES } from '../constants/roles'
import { getCompanyForUser } from '../utils/company'

const ALLOWED_DURING_MAINTENANCE = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/bootstrap-admin',
  '/api/time-entries/clock-out',
  '/api/time-entries/status',
]

/** Allow clock-out / end-break style paths during maintenance for authenticated users. */
export async function maintenanceGuard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (ALLOWED_DURING_MAINTENANCE.some((p) => req.path === p || req.originalUrl.startsWith(p))) {
      return next()
    }
    // Ending breaks
    if (req.method === 'PUT' && req.path.includes('/breaks/')) {
      return next()
    }

    const company = await getCompanyForUser(req.auth?.companyId)
    if (!company.maintenanceMode) return next()

    if (req.auth?.role === ROLES.ADMIN) return next()

    return res.status(503).json({
      error: 'maintenance',
      message: company.maintenanceMessage || 'Hourly is temporarily unavailable for maintenance.',
    })
  } catch {
    return next()
  }
}
