import type { AdminRole } from '@/modules/rbac/roles'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  success: true
  role: AdminRole
}

export interface AuthUser {
  id: string
  email: string
  role: AdminRole
  sessionId: string
}
