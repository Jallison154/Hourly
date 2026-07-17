export const ROLES = {
  EMPLOYEE: 'EMPLOYEE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ROLE_VALUES: Role[] = [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN]

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value as Role)
}

export function roleAtLeast(role: Role, minimum: Role): boolean {
  const rank: Record<Role, number> = {
    EMPLOYEE: 1,
    MANAGER: 2,
    ADMIN: 3,
  }
  return rank[role] >= rank[minimum]
}
