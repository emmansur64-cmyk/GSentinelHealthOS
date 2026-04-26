import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
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
    getTenantIdFromContext();

    await prisma.activityLog.create({
      data: {
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