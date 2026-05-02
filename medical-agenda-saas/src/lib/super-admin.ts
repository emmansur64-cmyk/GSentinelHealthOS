import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

import { fail } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { CLINIC_STATUS_LABEL, statusBadgeClass } from "@/lib/status-labels";
import { isSuperAdminRoleValue } from "@/lib/super-admin-policy";

export type ClinicStatus = "pending" | "active" | "suspended" | "disabled" | "trial";

export type SuperAdminUser = {
  userId: string;
  role: string;
  tenantId: string;
};

export function isSuperAdminRole(role: string | null | undefined) {
  return isSuperAdminRoleValue(role);
}

export async function requireSuperAdminPage(): Promise<SuperAdminUser> {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/login");
  if (!isSuperAdminRole(String(auth.role))) redirect("/dashboard");
  return { userId: auth.userId, role: String(auth.role), tenantId: auth.tenantId };
}

export async function requireSuperAdminApi() {
  const auth = await getAuthenticatedUser();
  if (!auth) return { ok: false as const, response: fail("No autenticado", 401) };
  if (!isSuperAdminRole(String(auth.role))) return { ok: false as const, response: fail("Forbidden", 403) };
  return { ok: true as const, user: { userId: auth.userId, role: String(auth.role), tenantId: auth.tenantId } };
}

export function getRequestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export async function writeAdminAudit(input: {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  clinicId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}) {
  await prisma.$executeRaw`
    INSERT INTO admin_audit_logs (
      actor_user_id, action, target_type, target_id, clinic_id, metadata_json, ip_address
    )
    VALUES (
      ${input.actorUserId},
      ${input.action},
      ${input.targetType},
      ${input.targetId ?? null},
      ${input.clinicId ?? null},
      ${input.metadata ?? Prisma.JsonNull},
      ${input.ipAddress ?? null}
    )
  `;
}

export { CLINIC_STATUS_LABEL, statusBadgeClass };

export type DashboardMetrics = {
  active_clinics: number;
  suspended_clinics: number;
  active_users: number;
  logins_24h: number;
  whatsapp_connected: number;
  whatsapp_error: number;
  appointments_today: number;
  recent_errors: number;
};

export async function getSuperAdminDashboard(): Promise<DashboardMetrics> {
  const rows = await prisma.$queryRaw<DashboardMetrics[]>`
    SELECT
      (SELECT COUNT(*)::int FROM tenants WHERE id <> 'default' AND estado = 'active') AS active_clinics,
      (SELECT COUNT(*)::int FROM tenants WHERE id <> 'default' AND estado = 'suspended') AS suspended_clinics,
      (SELECT COUNT(*)::int FROM users WHERE tenant_id <> 'default' AND active = true AND COALESCE(status, 'active') = 'active') AS active_users,
      (SELECT COUNT(*)::int FROM activity_logs WHERE action = 'auth.login' AND created_at >= NOW() - INTERVAL '24 hours') AS logins_24h,
      (SELECT COUNT(*)::int FROM clinic_whatsapp_accounts WHERE status = 'connected') AS whatsapp_connected,
      (SELECT COUNT(*)::int FROM clinic_whatsapp_accounts WHERE status IN ('error', 'disconnected')) AS whatsapp_error,
      (SELECT COUNT(*)::int FROM appointments WHERE DATE(datetime) = CURRENT_DATE) AS appointments_today,
      (
        SELECT COUNT(*)::int
        FROM failed_messages
        WHERE created_at >= NOW() - INTERVAL '24 hours'
          AND status IN ('pending', 'retrying')
      ) AS recent_errors
  `;
  return rows[0] ?? {
    active_clinics: 0,
    suspended_clinics: 0,
    active_users: 0,
    logins_24h: 0,
    whatsapp_connected: 0,
    whatsapp_error: 0,
    appointments_today: 0,
    recent_errors: 0,
  };
}

export type AdminClinicRow = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  maintenance_mode: boolean;
  created_at: Date;
  whatsapp_status: string;
  last_login_at: Date | null;
  user_count: number;
};

export async function getAdminClinics(limit = 100): Promise<AdminClinicRow[]> {
  return prisma.$queryRaw<AdminClinicRow[]>`
    SELECT
      t.id,
      t.nombre AS name,
      t.slug,
      t.legal_name,
      t.email,
      t.phone,
      t.estado::text AS status,
      t.maintenance_mode,
      t.created_at,
      COALESCE(MAX(cwa.status::text), 'pending') AS whatsapp_status,
      MAX(u.last_login_at) AS last_login_at,
      COUNT(DISTINCT u.id)::int AS user_count
    FROM tenants t
    LEFT JOIN users u ON u.tenant_id = t.id AND u.active = true
    LEFT JOIN clinic_whatsapp_accounts cwa ON cwa.tenant_id = t.id AND cwa.is_active = true
    WHERE t.id <> 'default'
    GROUP BY t.id, t.nombre, t.slug, t.legal_name, t.email, t.phone, t.estado, t.maintenance_mode, t.created_at
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `;
}

export async function getRecentAdminAudit(limit = 50, clinicId?: string) {
  const where = clinicId ? Prisma.sql`WHERE aal.clinic_id = ${clinicId}` : Prisma.empty;
  return prisma.$queryRaw<Array<{
    id: string;
    actor_user_id: string | null;
    actor_name: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    clinic_id: string | null;
    clinic_name: string | null;
    metadata_json: unknown;
    ip_address: string | null;
    created_at: Date;
  }>>(Prisma.sql`
    SELECT
      aal.id,
      aal.actor_user_id,
      u.name AS actor_name,
      aal.action,
      aal.target_type,
      aal.target_id,
      aal.clinic_id,
      t.nombre AS clinic_name,
      aal.metadata_json,
      aal.ip_address,
      aal.created_at
    FROM admin_audit_logs aal
    LEFT JOIN users u ON u.id = aal.actor_user_id
    LEFT JOIN tenants t ON t.id = aal.clinic_id
    ${where}
    ORDER BY aal.created_at DESC
    LIMIT ${limit}
  `);
}
