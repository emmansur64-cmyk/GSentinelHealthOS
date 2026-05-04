import type { Prisma, Role } from "@prisma/client";

import { auditLog } from "@/lib/compliance/audit-log";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-logger";

type AuditServiceInput = {
  tenantId: string;
  userId?: string | null;
  role?: Role | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function safeJson(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export async function writeAuditLog(input: AuditServiceInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        tenant_id: input.tenantId,
        user_id: input.userId ?? null,
        role: input.role ?? null,
        action: input.action,
        entity: input.entity,
        entity_id: input.entityId ?? null,
        details: safeJson(input.details) as Prisma.InputJsonValue,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      },
    });

    await auditLog({
      tenantId: input.tenantId,
      actorUserId: input.userId ?? null,
      entityType: input.entity,
      entityId: input.entityId ?? null,
      action: "UPDATE",
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        action_label: input.action,
        details: safeJson(input.details) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    logServerError("audit_service.write_failed", error, {
      tenant_id: input.tenantId,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
    });
  }
}
