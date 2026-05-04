import { createHash } from "node:crypto";

import { ConsentAppliesTo, ConsentChannel, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function normalizeIp(value: string | null | undefined) {
  return value?.trim() || null;
}

function computeEvidenceHash(input: {
  tenantId: string;
  patientId: string;
  consentTemplateId: string;
  acceptedAt: Date;
  channel: ConsentChannel;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const payload = {
    tenant_id: input.tenantId,
    patient_id: input.patientId,
    consent_template_id: input.consentTemplateId,
    accepted_at: input.acceptedAt.toISOString(),
    channel: input.channel,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function hasActiveConsent(input: {
  tenantId: string;
  patientId: string;
  appliesTo: ConsentAppliesTo;
}): Promise<boolean> {
  const consent = await prisma.patientConsent.findFirst({
    where: {
      tenant_id: input.tenantId,
      patient_id: input.patientId,
      revoked_at: null,
      consentTemplate: {
        tenant_id: input.tenantId,
        applies_to: input.appliesTo,
        active: true,
      },
    },
    orderBy: { accepted_at: "desc" },
    select: { id: true },
  });

  return Boolean(consent?.id);
}

export async function registerConsentAcceptance(input: {
  tenantId: string;
  patientId: string;
  consentTemplateId: string;
  channel: ConsentChannel;
  acceptedByUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const acceptedAt = new Date();
  const evidenceHash = computeEvidenceHash({
    tenantId: input.tenantId,
    patientId: input.patientId,
    consentTemplateId: input.consentTemplateId,
    acceptedAt,
    channel: input.channel,
    ipAddress: normalizeIp(input.ipAddress),
    userAgent: input.userAgent,
  });

  const db = input.tx ?? prisma;

  return db.patientConsent.create({
    data: {
      tenant_id: input.tenantId,
      patient_id: input.patientId,
      consent_template_id: input.consentTemplateId,
      accepted_at: acceptedAt,
      accepted_by_user_id: input.acceptedByUserId ?? null,
      ip_address: normalizeIp(input.ipAddress),
      user_agent: input.userAgent ?? null,
      channel: input.channel,
      evidence_hash: evidenceHash,
    },
  });
}

export async function revokeConsent(input: {
  tenantId: string;
  patientId: string;
  consentTemplateId?: string;
}) {
  const where: Prisma.PatientConsentWhereInput = {
    tenant_id: input.tenantId,
    patient_id: input.patientId,
    revoked_at: null,
  };

  if (input.consentTemplateId) {
    where.consent_template_id = input.consentTemplateId;
  }

  return prisma.patientConsent.updateMany({
    where,
    data: { revoked_at: new Date() },
  });
}
