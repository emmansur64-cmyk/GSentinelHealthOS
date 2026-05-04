import { createHash } from "node:crypto";

import { ClinicalRecordStatus, type ClinicalRecordType, type ClinicalRecordSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/compliance/audit-log";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildRecordHashPayload(input: {
  tenantId: string;
  patientId: string;
  type: ClinicalRecordType;
  source: ClinicalRecordSource;
  title: string;
  content: string;
  createdByUserId: string;
  createdAt: Date;
  previousHash?: string | null;
}) {
  return {
    tenant_id: input.tenantId,
    patient_id: input.patientId,
    type: input.type,
    source: input.source,
    title: input.title,
    content: input.content,
    created_by_user_id: input.createdByUserId,
    created_at: input.createdAt.toISOString(),
    previous_hash: input.previousHash ?? null,
  };
}

export async function createClinicalRecord(input: {
  tenantId: string;
  patientId: string;
  doctorId?: string | null;
  appointmentId?: string | null;
  type: ClinicalRecordType;
  title: string;
  content: string;
  source: ClinicalRecordSource;
  createdByUserId: string;
  status?: ClinicalRecordStatus;
}) {
  const createdAt = new Date();
  const previous = await prisma.clinicalRecord.findFirst({
    where: { tenant_id: input.tenantId, patient_id: input.patientId },
    orderBy: { created_at: "desc" },
    select: { hash: true },
  });

  const payload = buildRecordHashPayload({
    tenantId: input.tenantId,
    patientId: input.patientId,
    type: input.type,
    source: input.source,
    title: input.title,
    content: input.content,
    createdByUserId: input.createdByUserId,
    createdAt,
    previousHash: previous?.hash ?? null,
  });
  const hash = sha256(JSON.stringify(payload));

  const record = await prisma.clinicalRecord.create({
    data: {
      tenant_id: input.tenantId,
      patient_id: input.patientId,
      doctor_id: input.doctorId ?? null,
      appointment_id: input.appointmentId ?? null,
      type: input.type,
      title: input.title,
      content: input.content,
      source: input.source,
      status: input.status ?? "DRAFT",
      created_by_user_id: input.createdByUserId,
      created_at: createdAt,
      hash,
      previous_hash: previous?.hash ?? null,
    },
  });

  await auditLog({
    tenantId: input.tenantId,
    actorUserId: input.createdByUserId,
    patientId: input.patientId,
    entityType: "clinical_record",
    entityId: record.id,
    action: "CREATE",
    metadata: {
      type: input.type,
      source: input.source,
      status: record.status,
      appointment_id: input.appointmentId ?? null,
      doctor_id: input.doctorId ?? null,
      hash: record.hash,
      previous_hash: record.previous_hash,
    },
  });

  return record;
}

export async function voidClinicalRecord(input: {
  tenantId: string;
  clinicalRecordId: string;
  reason: string;
  actorUserId: string;
}) {
  const updated = await prisma.clinicalRecord.updateMany({
    where: {
      id: input.clinicalRecordId,
      tenant_id: input.tenantId,
      status: { not: "VOIDED" },
    },
    data: {
      status: "VOIDED",
      voided_at: new Date(),
      voided_reason: input.reason,
      voided_by_user_id: input.actorUserId,
    },
  });

  await auditLog({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    entityType: "clinical_record",
    entityId: input.clinicalRecordId,
    action: "UPDATE",
    metadata: {
      operation: "void",
      reason: input.reason,
      updated_count: updated.count,
    },
  });

  return updated.count;
}
