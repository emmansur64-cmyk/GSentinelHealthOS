import { auditMedicalConversationMemory, auditMedicalConversationMemoryError } from "./audit";
import { getMedicalConversationMemoryConfig } from "./config";
import { summarizeMedicalConversationMemory } from "./summarizer";
import type { MedicalConversationMemory, MedicalConversationMemoryInput } from "./types";

export const MEDICAL_CONVERSATION_MEMORY_INSTRUCTION =
  "Usar esta memoria solo como contexto conversacional reciente del medico. No asumir que resume toda la historia clinica. No mezclar pacientes ni tenants. No reemplazar criterio medico.";

function buildEmptyMemory(input: MedicalConversationMemoryInput, errors: string[] = []): MedicalConversationMemory {
  const config = getMedicalConversationMemoryConfig();
  const now = new Date();
  return {
    instruction: MEDICAL_CONVERSATION_MEMORY_INSTRUCTION,
    generatedAt: now.toISOString(),
    enabled: config.enabled,
    fallback: true,
    scope: {
      tenantId: input.tenantId,
      doctorUserId: input.doctorUserId,
      conversationId: input.conversationId,
      patientId: input.patientId ?? null,
      appointmentId: input.appointmentId ?? null,
    },
    policy: {
      ttlHours: config.ttlHours,
      maxExchanges: config.maxExchanges,
      maxSummaryChars: config.maxSummaryChars,
      sourceExchangeCount: 0,
    },
    summary: "",
    recentDecisions: [],
    medicationMentions: [],
    hypotheses: [],
    specialtyContext: null,
    activeConversation: false,
    expiresAt: new Date(now.getTime() + config.ttlHours * 60 * 60 * 1000).toISOString(),
    errors,
  };
}

export async function buildMedicalConversationMemory(
  input: MedicalConversationMemoryInput,
): Promise<MedicalConversationMemory | null> {
  const config = getMedicalConversationMemoryConfig();
  if (!config.enabled) return null;

  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.ttlHours * 60 * 60 * 1000);
    const cutoff = new Date(now.getTime() - config.ttlHours * 60 * 60 * 1000);
    const scoped = input.exchanges
      .filter((exchange) => new Date(exchange.createdAt).getTime() >= cutoff.getTime())
      .slice(-config.maxExchanges);

    const compressed = summarizeMedicalConversationMemory(scoped, config);
    const memory: MedicalConversationMemory = {
      instruction: MEDICAL_CONVERSATION_MEMORY_INSTRUCTION,
      generatedAt: now.toISOString(),
      enabled: true,
      fallback: false,
      scope: {
        tenantId: input.tenantId,
        doctorUserId: input.doctorUserId,
        conversationId: input.conversationId,
        patientId: input.patientId ?? null,
        appointmentId: input.appointmentId ?? null,
      },
      policy: {
        ttlHours: config.ttlHours,
        maxExchanges: config.maxExchanges,
        maxSummaryChars: config.maxSummaryChars,
        sourceExchangeCount: scoped.length,
      },
      ...compressed,
      activeConversation: scoped.length > 0,
      expiresAt: expiresAt.toISOString(),
      errors: [],
    };

    auditMedicalConversationMemory(memory);
    return memory;
  } catch (error) {
    auditMedicalConversationMemoryError(error, "memory_builder_failed");
    const fallback = buildEmptyMemory(input, ["memory_builder_failed"]);
    auditMedicalConversationMemory(fallback);
    return fallback;
  }
}

