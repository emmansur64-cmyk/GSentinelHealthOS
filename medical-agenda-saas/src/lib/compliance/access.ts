import { fail } from "@/lib/api-response";
import { getAuthenticatedUser, type AuthenticatedUser } from "@/lib/server-auth";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { auditLog } from "@/lib/compliance/audit-log";
import { isRoleAllowed, type ComplianceRole } from "@/lib/compliance/roles";

export async function requireRole(user: AuthenticatedUser | null, roles: ComplianceRole[]) {
  if (!user) return { ok: false as const, response: fail("No autenticado", 401) };

  const allowed = isRoleAllowed(String(user.role), roles);
  if (!allowed) {
    await auditLog({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      entityType: "access_control",
      action: "SECURITY_DENIED",
      metadata: {
        reason: "role_not_allowed",
        required_roles: roles,
        user_role: user.role,
      },
    });

    return { ok: false as const, response: fail("Sin permisos", 403) };
  }

  return { ok: true as const };
}

export async function requireTenantAccess(args: {
  authUser: AuthenticatedUser | null;
  resourceTenantId?: string | null;
  entityType: string;
  entityId?: string | null;
}) {
  const { authUser, resourceTenantId, entityType, entityId } = args;

  if (!authUser) return { ok: false as const, response: fail("No autenticado", 401) };

  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return { ok: false as const, response: tenant.response };

  if (resourceTenantId && resourceTenantId !== tenant.tenant.id) {
    await auditLog({
      tenantId: authUser.tenantId,
      actorUserId: authUser.userId,
      entityType,
      entityId,
      action: "SECURITY_DENIED",
      metadata: {
        reason: "tenant_mismatch",
        requested_tenant_id: resourceTenantId,
        actor_tenant_id: tenant.tenant.id,
      },
    });
    return { ok: false as const, response: fail("Recurso fuera de tenant", 403) };
  }

  return { ok: true as const, tenantId: tenant.tenant.id };
}

export async function requireSessionWithTenant() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return { ok: false as const, response: fail("No autenticado", 401) };

  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return { ok: false as const, response: tenant.response };

  return {
    ok: true as const,
    authUser,
    tenantId: tenant.tenant.id,
  };
}
