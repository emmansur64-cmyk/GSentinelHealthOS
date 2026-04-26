import type { Prisma, Role } from "@prisma/client";

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

    await prisma.auditLog.create({
      data: {
        user_id: input.userId ?? null,
        action: input.action,
        entity_id: input.entityId ?? null,
        entity_type: input.entity,
        payload_after: safeJson(input.details) as Prisma.InputJsonValue,
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
