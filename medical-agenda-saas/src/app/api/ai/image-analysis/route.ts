import { Role } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import { logAudit, requestMeta } from "@/lib/audit";
import { formatMedicalImageAnalysisReport } from "@/lib/ai-image-analysis-format";
import { auditLog } from "@/lib/compliance/audit-log";
import { createClinicalRecord } from "@/lib/compliance/clinical-records";
import { hasActiveConsent } from "@/lib/compliance/consent";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getAuthenticatedUser, hasRole, type AuthenticatedUser } from "@/lib/server-auth";
import {
  analyzeMedicalImage,
  detectMimeType,
  GroqImageAnalysisError,
  hasDangerousExtension,
  sanitizeFilename,
  type AiImageAnalysisRole,
  type AiImageAnalysisSource,
} from "@/server/ai/groqImageAnalysis";

export const runtime = "nodejs";

const USER_ERROR_GENERIC = "No se pudo analizar la imagen. Verificá el formato o intentá nuevamente.";
const USER_ERROR_TOO_LARGE = "El archivo supera el tamaño permitido.";
const USER_ERROR_FORBIDDEN = "No tenés permisos para realizar esta acción.";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: { message } }, { status });
}

function resolveAiRole(user: AuthenticatedUser): AiImageAnalysisRole | null {
  if (hasRole(user, [Role.doctor, Role.medico])) return "doctor";
  if (hasRole(user, [Role.secretaria, Role.recepcionista, Role.receptionist, Role.clinic_admin, Role.clinic_owner])) return "secretary";
  if (hasRole(user, [Role.admin, Role.super_admin])) return "admin";
  return null;
}

function parseSource(value: FormDataEntryValue | null): AiImageAnalysisSource {
  return value === "doctor_chat" ? "doctor_chat" : "secretary_panel";
}

function getClientMime(file: File): string {
  const value = file.type.toLowerCase().trim();
  if (value === "image/jpg") return "image/jpeg";
  return value;
}

async function writeAnalysisLog(input: {
  user: AuthenticatedUser;
  role: AiImageAnalysisRole | null;
  source: AiImageAnalysisSource;
  imageMimeType: string;
  imageSizeBytes: number;
  imageTypeDetected?: string | null;
  confidence?: string | null;
  status: "SUCCESS" | "FAILED";
  errorCode?: string | null;
}) {
  try {
    return await prisma.aiImageAnalysisLog.create({
      data: {
        user_id: input.user.userId,
        role: input.user.role,
        source: input.source,
        image_mime_type: input.imageMimeType,
        image_size_bytes: input.imageSizeBytes,
        image_type_detected: input.imageTypeDetected ?? null,
        confidence: input.confidence ?? null,
        status: input.status,
        error_code: input.errorCode ?? null,
      },
    });
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonError(USER_ERROR_FORBIDDEN, 401);
  if (!user.tenantId) return jsonError(USER_ERROR_FORBIDDEN, 403);

  const aiRole = resolveAiRole(user);
  if (!aiRole) return jsonError(USER_ERROR_FORBIDDEN, 403);

  const meta = requestMeta(request);
  let source: AiImageAnalysisSource = "secretary_panel";
  let imageMimeType = "unknown";
  let imageSizeBytes = 0;
  let patientId: string | null = null;

  try {
    const rate = consumeRateLimit({
      key: `ai-image-analysis:${user.tenantId}:${user.userId}`,
      limit: 12,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.allowed) {
      throw new GroqImageAnalysisError("RATE_LIMITED", USER_ERROR_GENERIC, 429);
    }

    const formData = await request.formData();
    source = parseSource(formData.get("source"));
    patientId = typeof formData.get("patientId") === "string" ? String(formData.get("patientId")).trim() : null;
    const file = formData.get("file");
    const optionalContext = typeof formData.get("optionalContext") === "string" ? String(formData.get("optionalContext")) : undefined;

    if (!(file instanceof File)) throw new GroqImageAnalysisError("FILE_REQUIRED");

    const filename = sanitizeFilename(file.name || "archivo");
    if (!filename || hasDangerousExtension(filename)) throw new GroqImageAnalysisError("FILENAME_BLOCKED");

    const buffer = Buffer.from(await file.arrayBuffer());
    imageSizeBytes = buffer.byteLength;
    imageMimeType = getClientMime(file);
    const detectedMime = detectMimeType(buffer);
    if (detectedMime === "unknown" || detectedMime !== imageMimeType) {
      throw new GroqImageAnalysisError("MIME_INVALID");
    }

    if (patientId) {
      const hasConsent = await hasActiveConsent({
        tenantId: user.tenantId,
        patientId,
        appliesTo: "AI_ASSISTANT",
      });

      if (!hasConsent) {
        await auditLog({
          tenantId: user.tenantId,
          actorUserId: user.userId,
          patientId,
          entityType: "ai_image_analysis",
          action: "SECURITY_DENIED",
          metadata: {
            reason: "missing_active_consent",
            applies_to: "AI_ASSISTANT",
            source,
          },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });

        return jsonError("El paciente no tiene consentimiento activo para asistencia IA.", 403);
      }
    }

    const analysis = await analyzeMedicalImage({
      tenantId: user.tenantId,
      userId: user.userId,
      role: aiRole,
      fileBuffer: buffer,
      mimeType: detectedMime,
      source,
      optionalContext,
    });

    const logRow = await writeAnalysisLog({
      user,
      role: aiRole,
      source,
      imageMimeType: detectedMime,
      imageSizeBytes,
      imageTypeDetected: analysis.imageType,
      confidence: analysis.confidence,
      status: "SUCCESS",
    });

    await logAudit({
      userId: user.userId,
      role: user.role,
      action: "ai_image_analysis.success",
      entity: "AiImageAnalysisLog",
      entityId: logRow?.id ?? null,
      details: {
        source,
        imageMimeType: detectedMime,
        imageSizeBytes,
        imageTypeDetected: analysis.imageType,
        confidence: analysis.confidence,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await auditLog({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      patientId,
      entityType: "ai_image_analysis",
      action: "AI_ACCESS",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        source,
        imageMimeType: detectedMime,
        imageSizeBytes,
        confidence: analysis.confidence,
        imageType: analysis.imageType,
      },
    });

    if (patientId) {
      await createClinicalRecord({
        tenantId: user.tenantId,
        patientId,
        doctorId: aiRole === "doctor" ? user.userId : null,
        type: "AI_TRIAGE",
        title: "Resumen preliminar IA de imagen",
        content: formatMedicalImageAnalysisReport(analysis),
        source: "AI",
        status: "DRAFT",
        createdByUserId: user.userId,
      });
    }

    return NextResponse.json({ ok: true, data: analysis });
  } catch (error) {
    const controlled =
      error instanceof GroqImageAnalysisError
        ? error
        : new GroqImageAnalysisError("UNEXPECTED_ERROR", USER_ERROR_GENERIC, 500);

    await writeAnalysisLog({
      user,
      role: aiRole,
      source,
      imageMimeType,
      imageSizeBytes,
      status: "FAILED",
      errorCode: controlled.code,
    });

    await logAudit({
      userId: user.userId,
      role: user.role,
      action: "ai_image_analysis.failed",
      entity: "AiImageAnalysisLog",
      details: {
        source,
        imageMimeType,
        imageSizeBytes,
        errorCode: controlled.code,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const message = controlled.code === "FILE_TOO_LARGE" ? USER_ERROR_TOO_LARGE : controlled.userMessage || USER_ERROR_GENERIC;
    const status = controlled.code === "ROLE_FORBIDDEN" ? 403 : controlled.status;
    return jsonError(message, status);
  }
}
