export type TenantStatus = 'active' | 'suspended' | 'pending' | 'disabled' | 'trial'
export type TenantPlan = 'basico' | 'profesional' | 'enterprise'

export interface Tenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  plan: TenantPlan
  clinicCount: number
  userCount: number
  createdAt: string
  updatedAt: string
}

export interface TenantUpdatePayload {
  status?: TenantStatus
  plan?: TenantPlan
}
