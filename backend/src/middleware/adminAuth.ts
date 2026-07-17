/**
 * Legacy admin password JWT is retired for day-to-day admin access.
 * Administrators use normal user accounts with role ADMIN.
 * See POST /api/auth/bootstrap-admin for one-time promotion via ADMIN_PASSWORD.
 */
export { requireAdmin, requireManagerOrAdmin, requireRole, authenticate } from './auth'
export type { AuthRequest, AuthUser } from './auth'
