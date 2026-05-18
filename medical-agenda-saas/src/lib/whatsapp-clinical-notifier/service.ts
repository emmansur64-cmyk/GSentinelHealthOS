import type { MetaBrainDecision } from "@/lib/metabrain";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/compliance/audit-log";
import { buildTransferPreview } from "@/lib/whatsapp-clinical-notifier/message";
import { detectTransferProtocolIntent } from "@/lib/whatsapp-clinical-notifier/intent";
import { isValidArMobileE164 } from "@/lib/whatsapp-clinical-notifier/phone";
import type { TransferPreviewPayload } from "@/lib/whatsapp-clinical-notifier/types";
import { sendClinicalWhatsAppNotification } from "@/lib/whatsapp-clinical-notifier/notifier";

const ENTITY_TYPE = "doctor_chat_transfer_protocol";
const PREVIEW_ACTION = "doctor.chat.transfer.preview";
const DISPATCH_ACTION = "doctor.chat.transfer.dispatch";

type ServiceInput = {
  tenantId: string;
  actorUserId: string;
  doctorId: string;
  conversationId: string;
  message: string;
  patient: { id: string; name: string; document?: string | null } | null;
  clinicalState?: string | null;
  metadata?: Record<string, unknown>;
};

async function loadPendingPreview(tenantId: string, conversationId: string): Promise<TransferPreviewPayload | null> {
  const row = await prisma.auditLog.findFirst({
    where: {
      tenant_id: tenantId,
      entity_type: ENTITY_TYPE,
      entity_id: conversationId,
      action: PREVIEW_ACTION,
    },
    orderBy: { created_at: "desc" },
  });

  if (!row?.payload_after || typeof row.payload_after !== "object") return null;
  const payload = row.payload_after as Record<string, unknown>;
  if (typeof payload.messageBody !== "string" || typeof payload.destinationPhone !== "string") return null;

  return payload as unknown as TransferPreviewPayload;
}

async function doctorHasPatientAccess(input: { tenantId: string; doctorId: string; patientId: string }): Promise<boolean> {
  const patient = await prisma.patient.findFirst({
    where: {
      id: input.patientId,
      tenant_id: input.tenantId,
    },
    select: { id: true },
  });
  const doctor = await prisma.doctorProfile.findFirst({
    where: {
      user_id: input.doctorId,
      tenant_id: input.tenantId,
    },
    select: { user_id: true },
  });
  return Boolean(patient && doctor);
}

function extractString(value: unknown): string {
  return String(value ?? "").trim();
}

export async function maybeHandleTransferProtocolNotification(input: ServiceInput): Promise<MetaBrainDecision | null> {
  const intent = detectTransferProtocolIntent(input.message);

  if (intent.isExplicitConfirmation) {
    const pending = await loadPendingPreview(input.tenantId, input.conversationId);
    if (!pending) {
      return {
        action: "SEND_TRANSFER_PROTOCOL_WHATSAPP_CONFIRMATION_REJECTED",
        response: "No existe una solicitud pendiente de confirmacion para envio de protocolo.",
        confidence: 0.98,
        source: "RULES",
      };
    }

    if (!isValidArMobileE164(pending.destinationPhone)) {
      return {
        action: "SEND_TRANSFER_PROTOCOL_WHATSAPP_DENIED",
        response: "El numero destino pendiente no es valido en formato +549. Genera un nuevo preview con un numero correcto.",
        confidence: 0.98,
        source: "RULES",
      };
    }

    const provider = await sendClinicalWhatsAppNotification({
      tenantId: input.tenantId,
      to: pending.destinationPhone,
      body: pending.messageBody,
    });

    await auditLog({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      patientId: pending.patientId,
      entityType: ENTITY_TYPE,
      entityId: input.conversationId,
      action: "AI_ACCESS",
      metadata: {
        stage: "dispatch",
        destination_phone: pending.destinationPhone,
        content_hash: pending.contentHash,
        provider_status: provider.providerStatus,
        provider_message_id: provider.providerMessageId,
        provider_response: provider.providerResponse,
        dry_run: provider.dryRun,
        sent: provider.sent,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenant_id: input.tenantId,
        user_id: input.actorUserId,
        action: DISPATCH_ACTION,
        action_type: "UPDATE",
        entity_type: ENTITY_TYPE,
        entity_id: input.conversationId,
        patient_id: pending.patientId,
        payload_before: pending as unknown as object,
        payload_after: {
          status: provider.sent ? "sent" : provider.dryRun ? "dry_run" : "failed",
          provider_status: provider.providerStatus,
          provider_message_id: provider.providerMessageId,
          provider_response: provider.providerResponse,
        },
        metadata_json: {
          destination_phone: pending.destinationPhone,
          content_hash: pending.contentHash,
        },
      },
    });

    return {
      action: provider.dryRun ? "SEND_TRANSFER_PROTOCOL_WHATSAPP_DRY_RUN" : "SEND_TRANSFER_PROTOCOL_WHATSAPP_DISPATCHED",
      response: provider.dryRun
        ? `Dry-run activo: dispatch registrado para ${pending.destinationPhone}. No se envio WhatsApp real.`
        : `Protocolo enviado por WhatsApp a ${pending.destinationPhone}.`,
      confidence: 0.99,
      source: "RULES",
    };
  }

  if (intent.isSoftConfirmation) {
    return {
      action: "SEND_TRANSFER_PROTOCOL_WHATSAPP_CONFIRMATION_REJECTED",
      response: "No existe una solicitud pendiente de confirmacion para envio de protocolo.",
      confidence: 0.98,
      source: "RULES",
    };
  }

  if (!intent.isTransferProtocolIntent) return null;

  if (!input.patient) {
    return {
      action: "SEND_TRANSFER_PROTOCOL_WHATSAPP_DENIED",
      response: "No hay paciente seleccionado en este contexto. Selecciona el paciente antes de enviar el protocolo de traslado.",
      confidence: 0.99,
      source: "RULES",
    };
  }

  const hasAccess = await doctorHasPatientAccess({
    tenantId: input.tenantId,
    doctorId: input.doctorId,
    patientId: input.patient.id,
  });
  if (!hasAccess) {
    return {
      action: "SEND_TRANSFER_PROTOCOL_WHATSAPP_DENIED",
      response: "No tenes permiso para enviar notificaciones de traslado de este paciente.",
      confidence: 0.99,
      source: "RULES",
    };
  }

  const doctorProfile = await prisma.doctorProfile.findFirst({
    where: { tenant_id: input.tenantId, user_id: input.doctorId },
    include: { user: { select: { name: true } } },
  });

  const senderName = extractString(input.metadata?.transfer_sender_name) || doctorProfile?.user.name || "";
  const senderLicense = extractString(input.metadata?.transfer_sender_license) || doctorProfile?.matricula || "";
  const senderDirectPhone = extractString(input.metadata?.transfer_sender_direct_phone);

  const missing: string[] = [];
  if (!senderLicense) missing.push("matricula");
  if (!senderDirectPhone) missing.push("celular directo");

  if (missing.length > 0) {
    return {
      action: "SEND_TRANSFER_PROTOCOL_WHATSAPP_MISSING_DATA",
      response: `Faltan datos obligatorios del medico trasladante: ${missing.join(" y ")}. Envia esos datos para continuar.`,
      confidence: 0.99,
      source: "RULES",
    };
  }

  if (!intent.destinationPhone || !isValidArMobileE164(intent.destinationPhone)) {
    if (intent.hasPhoneDigitsHint) {
      return {
        action: "SEND_TRANSFER_PROTOCOL_WHATSAPP_INVALID_PHONE",
        response: "Numero de WhatsApp invalido. Debe incluir formato internacional valido.",
        confidence: 0.99,
        source: "RULES",
      };
    }
    return {
      action: "SEND_TRANSFER_PROTOCOL_WHATSAPP_DENIED",
      response: "El numero destino es invalido. Debe estar en formato +549...",
      confidence: 0.99,
      source: "RULES",
    };
  }

  const patientLabel = input.patient.document ? `${input.patient.name} (${input.patient.document})` : input.patient.name;
  const reason = extractString(input.metadata?.transfer_reason) || "Traslado para continuidad de atencion";
  const protocolSummary = extractString(input.metadata?.transfer_protocol_summary) || extractString(input.clinicalState) || "Sin resumen adicional cargado.";

  const preview = buildTransferPreview({
    destinationPhone: intent.destinationPhone,
    patientId: input.patient.id,
    patientLabel,
    reason,
    protocolSummary,
    senderName,
    senderLicense,
    senderDirectPhone,
  });

  await prisma.auditLog.create({
    data: {
      tenant_id: input.tenantId,
      user_id: input.actorUserId,
      action: PREVIEW_ACTION,
      action_type: "UPDATE",
      entity_type: ENTITY_TYPE,
      entity_id: input.conversationId,
      patient_id: input.patient.id,
      payload_after: preview as unknown as object,
      metadata_json: {
        destination_phone: preview.destinationPhone,
        content_hash: preview.contentHash,
      },
    },
  });

  return {
    action: "SEND_TRANSFER_PROTOCOL_WHATSAPP_CONFIRM_REQUIRED",
    response: [
      "Preview de notificacion WhatsApp (outbound-only):",
      "",
      preview.messageBody,
      "",
      `Para confirmar, responde exactamente: Confirmo enviar este protocolo por WhatsApp al numero ${preview.destinationPhone}`,
    ].join("\n"),
    confidence: 0.99,
    source: "RULES",
  };
}
