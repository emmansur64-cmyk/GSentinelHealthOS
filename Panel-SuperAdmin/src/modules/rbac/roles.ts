export const AdminRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  AUDITOR: 'AUDITOR',
  SUPPORT: 'SUPPORT',
} as const

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole]

// Higher number = more privilege
const HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 4,
  SYSTEM_ADMIN: 3,
  AUDITOR: 2,
  SUPPORT: 1,
}

export function hasMinRole(userRole: AdminRole, minRole: AdminRole): boolean {
  return HIERARCHY[userRole] >= HIERARCHY[minRole]
}

export function canAccess(userRole: AdminRole, allowedRoles: AdminRole[]): boolean {
  return allowedRoles.some((r) => HIERARCHY[userRole] >= HIERARCHY[r])
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  SYSTEM_ADMIN: 'System Admin',
  AUDITOR: 'Auditor',
  SUPPORT: 'Support',
}

// Which roles can access each module
export const MODULE_ACCESS: Record<string, AdminRole[]> = {
  'system-health': [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN, AdminRole.AUDITOR, AdminRole.SUPPORT],
  'tenants': [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN],
  'client-onboarding': [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN],
  'ai-providers': [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN],
  'feature-flags': [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN],
  'audit-logs': [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN, AdminRole.AUDITOR],
}
