import { logServer, logServerError } from "@/lib/server-logger";
import type { MedicalConversationMemory } from "./types";

export function auditMedicalConversationMemory(memory: MedicalConversationMemory): void {
  try {
    logServer("info", "medical_conversation_memory.audit", {
      enabled: memory.enabled,
      fallback: memory.fallback,
      tenant_id: memory.scope.tenantId,
      doctor_user_id: memory.scope.doctorUserId,
      conversation_id: memory.scope.conversationId,
      patient_scoped: Boolean(memory.scope.patientId),
      source_exchange_count: memory.policy.sourceExchangeCount,
      summary_chars: memory.summary.length,
      decisions: memory.recentDecisions.length,
      medications: memory.medicationMentions.length,
      hypotheses: memory.hypotheses.length,
      errors: memory.errors,
      expires_at: memory.expiresAt,
    });
  } catch {
    // Audit must not affect chat availability.
  }
}

export function auditMedicalConversationMemoryError(error: unknown, reason: string): void {
  try {
    logServerError("medical_conversation_memory.failed", error, {
      reason,
      fallback: true,
    });
  } catch {
    // Logging must never break chat fallback.
  }
}

