import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/compliance/audit-log";
import { getTenantIdFromContext } from "@/lib/tenant-context";

type AuditInput = {
  userId?: string | null;
  role?: Role | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAudit(input: AuditInput) {
  try {
    const tenantId = getTenantIdFromContext() ?? "default";

    await prisma.activityLog.create({
      data: {
        tenant_id: tenantId,
        user_id: input.userId ?? null,
        role: input.role ?? null,
        action: input.action,
        entity: input.entity,
        entity_id: input.entityId ?? null,
        details: input.details ? JSON.parse(JSON.stringify(input.details)) : undefined,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      },
    });

    await auditLog({
      tenantId,
      actorUserId: input.userId ?? null,
      entityType: input.entity,
      entityId: input.entityId ?? null,
      action: "UPDATE",
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        action_label: input.action,
        details: input.details,
      },
    });
  } catch {
    return;
  }
}

export function requestMeta(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");
  return { ipAddress, userAgent };
}