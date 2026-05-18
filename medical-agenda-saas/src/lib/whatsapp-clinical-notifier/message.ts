import { createHash } from "node:crypto";

import type { TransferPreviewPayload } from "@/lib/whatsapp-clinical-notifier/types";

function clip(value: string, max: number): string {
  const normalized = String(value ?? "").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3).trim()}...`;
}

export function buildTransferMessage(payload: {
  patientLabel: string;
  reason: string;
  protocolSummary: string;
  senderName: string;
  senderLicense: string;
  senderDirectPhone: string;
}): string {
  return [
    "Aviso de traslado clinico.",
    "",
    `Paciente: ${payload.patientLabel}.`,
    `Motivo: ${clip(payload.reason, 240)}.`,
    "",
    "Resumen operativo:",
    clip(payload.protocolSummary, 1200),
    "",
    "Medico trasladante:",
    `Dr/a. ${payload.senderName}`,
    `Matricula: ${payload.senderLicense}`,
    `Celular directo: ${payload.senderDirectPhone}`,
    "",
    "Este mensaje es una notificacion operativa unidireccional. Para coordinacion clinica, comunicarse directamente con el medico trasladante informado.",
  ].join("\n");
}

export function buildTransferPreview(input: Omit<TransferPreviewPayload, "messageBody" | "contentHash" | "createdAt">): TransferPreviewPayload {
  const messageBody = buildTransferMessage({
    patientLabel: input.patientLabel,
    reason: input.reason,
    protocolSummary: input.protocolSummary,
    senderName: input.senderName,
    senderLicense: input.senderLicense,
    senderDirectPhone: input.senderDirectPhone,
  });

  const contentHash = createHash("sha256").update(messageBody).digest("hex");
  return {
    ...input,
    messageBody,
    contentHash,
    createdAt: new Date().toISOString(),
  };
}
