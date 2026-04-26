import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-logger";
import { getTenantIdFromContext } from "@/lib/tenant-context";

type FunctionalAuditInput = {
  userId?: string | null;
  action: string;
  entityId?: string | null;
  entityType: string;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
};

function safeJson(input: unknown) {
  if (input === undefined) return undefined;
  return JSON.parse(JSON.stringify(input));
}

export async function logFunctionalAudit(input: FunctionalAuditInput) {
  try {
    getTenantIdFromContext();

    await prisma.auditLog.create({
      data: {
        user_id: input.userId ?? null,
        action: input.action,
        entity_id: input.entityId ?? null,
        entity_type: input.entityType,
        payload_before: safeJson(input.payloadBefore),
        payload_after: safeJson(input.payloadAfter),
      },
    });
  } catch (error) {
    logServerError("functional-audit.write.failed", error, {
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
    });
  }
}
