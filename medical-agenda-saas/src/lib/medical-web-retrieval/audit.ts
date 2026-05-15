import { logServer, logServerError } from "@/lib/server-logger";
import type { MedicalWebRetrievalInput, MedicalWebRetrievalResult } from "./types";

export function auditMedicalWebRetrieval(input: MedicalWebRetrievalInput, result: MedicalWebRetrievalResult): void {
  try {
    logServer("info", "medical_web_retrieval.audit", {
      tenant_id: input.tenantId,
      doctor_user_id: input.doctorUserId,
      conversation_id: input.conversationId,
      query: result.query,
      activated_by: result.activatedBy,
      sources_consulted: result.sourcesConsulted,
      sources_rejected: result.sourcesRejected,
      urls_finales: result.evidence.map((item) => item.url),
      fragments_used: result.evidence.length,
      fallback: result.fallback,
      used: result.used,
      error: result.error ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit logging must never break the clinical chat fallback path.
  }
}

export function auditMedicalWebRetrievalError(input: MedicalWebRetrievalInput, error: unknown): void {
  try {
    logServerError("medical_web_retrieval.error", error, {
      tenant_id: input.tenantId,
      doctor_user_id: input.doctorUserId,
      conversation_id: input.conversationId,
      fallback: true,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit logging must never break the clinical chat fallback path.
  }
}
