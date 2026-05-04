import { fail } from "@/lib/api-response";
import { requestMeta } from "@/lib/audit";
import { auditLog } from "@/lib/compliance/audit-log";
import { requireRole, requireSessionWithTenant } from "@/lib/compliance/access";
import type { ComplianceRole } from "@/lib/compliance/roles";

type GuardContext = {
  authUser: {
    userId: string;
    tenantId: string;
    role: string;
    sessionId: string;
  };
  tenantId: string;
};

export function withComplianceGuard(
  allowedRoles: ComplianceRole[],
  handler: (request: Request, context: GuardContext) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    const session = await requireSessionWithTenant();
    if (!session.ok) return session.response;

    const roleCheck = await requireRole(session.authUser, allowedRoles);
    if (!roleCheck.ok) {
      const meta = requestMeta(request);
      await auditLog({
        tenantId: session.tenantId,
        actorUserId: session.authUser.userId,
        entityType: "api_guard",
        action: "SECURITY_DENIED",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          endpoint: request.url,
          allowed_roles: allowedRoles,
          user_role: session.authUser.role,
        },
      });
      return roleCheck.response;
    }

    try {
      return await handler(request, {
        authUser: session.authUser,
        tenantId: session.tenantId,
      });
    } catch (error) {
      return fail("Error interno", 500, error instanceof Error ? error.message : null);
    }
  };
}
