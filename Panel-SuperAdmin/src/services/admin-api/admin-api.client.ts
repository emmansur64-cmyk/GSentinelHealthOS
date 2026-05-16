import { appConfig } from '@/config/app.config'
import { apiFetch } from '@/lib/api-client'
import type { Tenant, TenantUpdatePayload } from '@/modules/tenants/tenant.types'

const BASE = appConfig.services.agendaApi

// TODO: The Agenda API /admin/tenants endpoint requires an internal service key.
// Wire ADMIN_API_INTERNAL_KEY once the FastAPI admin routes are implemented.
function adminHeaders(): Record<string, string> {
  return {
    'x-internal-service': 'panel-super-admin',
    ...(process.env.ADMIN_API_INTERNAL_KEY
      ? { Authorization: `Bearer ${process.env.ADMIN_API_INTERNAL_KEY}` }
      : {}),
  }
}

export async function listTenants(): Promise<Tenant[]> {
  // TODO: implement GET /admin/tenants in FastAPI api service
  return apiFetch<Tenant[]>(`${BASE}/admin/tenants`, {
    headers: adminHeaders(),
    timeoutMs: 10000,
  })
}

export async function updateTenant(id: string, payload: TenantUpdatePayload): Promise<Tenant> {
  // TODO: implement PATCH /admin/tenants/:id in FastAPI api service
  return apiFetch<Tenant>(`${BASE}/admin/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: adminHeaders(),
  })
}
