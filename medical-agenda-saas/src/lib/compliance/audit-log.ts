import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-logger";

export type ComplianceAuditAction =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "EXPORT"
  | "LOGIN"
  | "CONSENT_ACCEPT"
  | "CONSENT_REVOKE"
  | "AI_ACCESS"
  | "SECURITY_DENIED";

type AuditLogInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  patientId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: ComplianceAuditAction;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
};

function safeJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildHashPayload(input: {
  tenantId: string;
  actorUserId?: string | null;
  patientId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: ComplianceAuditAction;
  createdAt: Date;
  metadata?: unknown;
  previousHash?: string | null;
}) {
  return {
    tenant_id: input.tenantId,
    actor_user_id: input.actorUserId ?? null,
    patient_id: input.patientId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    created_at: input.createdAt.toISOString(),
    metadata: input.metadata ?? null,
    previous_hash: input.previousHash ?? null,
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function auditLog(input: AuditLogInput): Promise<void> {
  const tenantId = input.tenantId?.trim() || "default";
  const createdAt = new Date();

  try {
    const previous = await prisma.auditLog.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      select: { hash: true },
    });

    const previousHash = previous?.hash ?? null;
    const payload = buildHashPayload({
      tenantId,
      actorUserId: input.actorUserId,
      patientId: input.patientId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      createdAt,
      metadata: input.metadata,
      previousHash,
    });
    const currentHash = sha256(JSON.stringify(payload));

    await prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: input.actorUserId ?? null,
        patient_id: input.patientId ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        action: input.action,
        action_type: input.action,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        metadata_json: safeJson(input.metadata),
        payload_after: safeJson(input.metadata),
        created_at: createdAt,
        hash: currentHash,
        previous_hash: previousHash,
      },
    });
  } catch (error) {
    logServerError("compliance.audit_log.failed", error, {
      tenant_id: tenantId,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
    });
  }
}
