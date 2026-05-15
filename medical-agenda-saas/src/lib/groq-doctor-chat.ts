import "server-only";

import { logServer, logServerError } from "@/lib/server-logger";
import type { DoctorProfileContext } from "@/lib/doctor-context";
import type { MetaBrainDecision, MetaBrainDecisionInput } from "@/lib/metabrain";
import type { MedicalConversationMemory } from "@/lib/medical-conversation-memory";
import type { MedicalReasoningContext } from "@/lib/medical-reasoning";
import type { MedicalSpecialtyProtocolContext } from "@/lib/medical-specialty-protocols";
import type { MedicalRuntimeContext } from "@/lib/medical-runtime-context";
import type { MedicalWebEvidenceFragment, MedicalWebRetrievalContext } from "@/lib/medical-web-retrieval";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

type GroqChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: unknown;
  model?: string;
};

type GroqDoctorChatConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
};

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
}

function parseNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  return Math.trunc(parseNumber(value, fallback, min, max));
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function clip(value: unknown, max = 1400): string {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}

function resolveApiKey(): string {
  const directKey = (
    process.env.DOCTOR_CHAT_GROQ_API_KEY ??
    process.env.GROQ_API_KEY_CHAT ??
    process.env.GROQ_API_KEY ??
    ""
  ).trim();
  if (directKey) return directKey;

  const documentBaseUrl = String(process.env.DOCUMENT_AI_BASE_URL ?? "").toLowerCase();
  const documentProvider = String(process.env.DOCUMENT_AI_PROVIDER ?? "").toLowerCase();
  if (documentProvider === "groq" || documentBaseUrl.includes("api.groq.com")) {
    return (process.env.DOCUMENT_AI_API_KEY ?? "").trim();
  }

  return "";
}

function getConfig(): GroqDoctorChatConfig {
  const apiKey = resolveApiKey();
  const enabled = parseBoolean(process.env.DOCTOR_CHAT_GROQ_ENABLED, true) && Boolean(apiKey);

  return {
    enabled,
    apiKey,
    baseUrl: stripTrailingSlash(
      (process.env.DOCTOR_CHAT_GROQ_BASE_URL ?? process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1").trim(),
    ),
    model:
      (process.env.DOCTOR_CHAT_GROQ_MODEL ??
        process.env.GROQ_MODEL_CHAT ??
        process.env.GROQ_MODEL ??
        process.env.NLG_GROQ_MODEL ??
        "llama-3.3-70b-versatile").trim(),
    temperature: parseNumber(process.env.DOCTOR_CHAT_GROQ_TEMPERATURE, 0.2, 0, 2),
    maxTokens: parseInteger(process.env.DOCTOR_CHAT_GROQ_MAX_TOKENS, 900, 128, 4096),
    timeoutMs: parseInteger(process.env.DOCTOR_CHAT_GROQ_TIMEOUT_MS, 20_000, 3_000, 120_000),
  };
}

function buildSystemPrompt(): string {
  return [
    "Eres un asistente clinico interno para un medico. Siempre estas hablando con el medico, nunca con un paciente.",
    "Este chat medico es independiente del canal de pacientes por WhatsApp. No gestiona turnos, citas, reservas ni reprogramaciones.",
    "No ofrezcas programar citas, no sugieras reservar turnos y no hables como si el medico necesitara una cita con otro doctor.",
    "El chat es libre: responde la consulta real del medico sobre casos clinicos, salud general, medicamentos, razonamiento clinico, seguimiento, estudios o comunicacion profesional.",
    "Si el medico solo saluda, responde brevemente y ofrece ayudar con un caso clinico, una duda de salud, medicamentos o revision de informacion medica.",
    "Usa el contexto del paciente solo cuando este disponible y sea relevante.",
    "Si el contexto incluye metadata.agenda, tratala solo como informacion operativa de referencia; no conviertas la respuesta en flujo de agenda.",
    "No inventes datos clinicos, estudios, antecedentes, dosis ni resultados. Si falta informacion, dilo.",
    "Si el usuario pregunta fecha u hora, usa el RUNTIME CONTEXT provisto. No respondas que no tenes acceso a la fecha actual si el contexto esta presente.",
    "Si recibes STRUCTURED MEDICAL REASONING, organiza la respuesta clinica con esas secciones y conserva sus limites de evidencia.",
    "Si recibes SPECIALTY MEDICAL PROTOCOL, adapta tono, red flags, evidencia y estructura al protocolo indicado sin inventar datos.",
    "Si recibes DOCTOR PROFILE CONTEXT, usalo solo para personalizar especialidad, idioma, region y preferencias del medico dentro del tenant actual.",
    "Responde en espanol claro, directo y util para trabajo clinico.",
    "No hagas marketing, no menciones que eres Groq y no prometas certeza diagnostica.",
    "Cuando haya riesgo de urgencia, prioriza conducta segura y evaluacion presencial.",
  ].join(" ");
}

function formatContext(context: MetaBrainDecisionInput["context"]): string {
  const patient = context.patient
    ? {
        id: context.patient.id,
        name: context.patient.name,
        notes: clip(context.patient.notes, 800),
      }
    : null;

  const appointment = context.current_appointment
    ? {
        id: context.current_appointment.id,
        datetime: context.current_appointment.datetime,
        status: context.current_appointment.status,
        notes: clip(context.current_appointment.notes, 800),
      }
    : null;

  const recentHistory = context.recent_history.slice(0, 8).map((item) => ({
    datetime: item.datetime,
    status: item.status,
    notes: clip(item.notes, 500),
    doctor_name: item.doctor_name ?? null,
  }));

  return JSON.stringify(
    {
      doctor_id: context.doctor_id,
      patient,
      current_appointment: appointment,
      clinical_state: clip(context.clinical_state, 1800) || null,
      recent_history: recentHistory,
      metadata: context.metadata ?? {},
    },
    null,
    2,
  );
}

function isMedicalWebEvidenceFragment(value: unknown): value is MedicalWebEvidenceFragment {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<MedicalWebEvidenceFragment>;
  return (
    typeof record.source === "string" &&
    typeof record.sourceType === "string" &&
    typeof record.title === "string" &&
    typeof record.url === "string" &&
    typeof record.fragment === "string" &&
    (record.date === null || typeof record.date === "string") &&
    (record.confidence === "medium" || record.confidence === "high")
  );
}

function getMedicalWebRetrievalContext(context: MetaBrainDecisionInput["context"]): MedicalWebRetrievalContext | null {
  const value = context.metadata?.medical_web_retrieval;
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<MedicalWebRetrievalContext>;
  if (typeof record.instruction !== "string" || !Array.isArray(record.sources)) return null;
  const sources = record.sources.filter(isMedicalWebEvidenceFragment);
  if (sources.length === 0) return null;
  return {
    instruction: record.instruction,
    query: typeof record.query === "string" ? record.query : "",
    sources,
  };
}

function getMedicalRuntimeContext(context: MetaBrainDecisionInput["context"]): MedicalRuntimeContext | null {
  const value = context.metadata?.medical_runtime_context;
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<MedicalRuntimeContext>;
  if (typeof record.instruction !== "string" || !record.time || typeof record.time !== "object") return null;
  return record as MedicalRuntimeContext;
}

function getMedicalConversationMemory(context: MetaBrainDecisionInput["context"]): MedicalConversationMemory | null {
  const value = context.metadata?.medical_conversation_memory;
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<MedicalConversationMemory>;
  if (typeof record.instruction !== "string" || typeof record.summary !== "string") return null;
  return record as MedicalConversationMemory;
}

function getDoctorProfileContext(context: MetaBrainDecisionInput["context"]): DoctorProfileContext | null {
  const value = context.metadata?.doctor_profile_context;
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<DoctorProfileContext>;
  if (typeof record.instruction !== "string" || !record.scope || !record.doctor) return null;
  return record as DoctorProfileContext;
}

function getMedicalReasoningContext(context: MetaBrainDecisionInput["context"]): MedicalReasoningContext | null {
  const value = context.metadata?.medical_reasoning;
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<MedicalReasoningContext>;
  if (typeof record.instruction !== "string" || !Array.isArray(record.requiredSections)) return null;
  return record as MedicalReasoningContext;
}

function getMedicalSpecialtyProtocolContext(
  context: MetaBrainDecisionInput["context"],
): MedicalSpecialtyProtocolContext | null {
  const value = context.metadata?.medical_specialty_protocol;
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<MedicalSpecialtyProtocolContext>;
  if (typeof record.instruction !== "string" || typeof record.specialty !== "string") return null;
  return record as MedicalSpecialtyProtocolContext;
}

function formatMedicalConversationMemory(memory: MedicalConversationMemory): string {
  return JSON.stringify(
    {
      instruccion_obligatoria: memory.instruction,
      alcance: {
        conversation_id: memory.scope.conversationId,
        patient_scoped: Boolean(memory.scope.patientId),
        appointment_scoped: Boolean(memory.scope.appointmentId),
      },
      politica: memory.policy,
      resumen_comprimido: clip(memory.summary, 2000),
      decisiones_recientes: memory.recentDecisions,
      medicamentos_mencionados: memory.medicationMentions,
      hipotesis_recientes: memory.hypotheses,
      especialidad_contexto: memory.specialtyContext,
      conversacion_activa: memory.activeConversation,
      expira_en: memory.expiresAt,
      fallback: memory.fallback,
      errores: memory.errors,
    },
    null,
    2,
  );
}

function formatDoctorProfileContext(context: DoctorProfileContext): string {
  return JSON.stringify(
    {
      instruccion_obligatoria: context.instruction,
      scope: context.scope,
      medico: context.doctor,
      clinica: context.clinic,
      locale: context.locale,
      contexto_especialidad: context.specialtyContext,
      guias_regionales: context.regionalGuidelines,
      preferencias: context.preferences,
      compatibilidad: context.compatibility,
      aislamiento: context.isolation,
      fallback: context.fallback,
      errores: context.errors,
    },
    null,
    2,
  );
}

function formatMedicalRuntimeContext(runtime: MedicalRuntimeContext): string {
  return JSON.stringify(
    {
      instruccion_obligatoria: runtime.instruction,
      fecha_hora: runtime.time,
      clima: runtime.weather,
      alertas_ambientales: runtime.environmentalAlerts,
      epidemiologia_auxiliar: runtime.epidemiology,
      fallback: runtime.fallback,
      errores: runtime.errors,
    },
    null,
    2,
  );
}

function formatMedicalWebEvidence(retrieval: MedicalWebRetrievalContext): string {
  const sources = retrieval.sources.slice(0, 5).map((item, index) => ({
    id: `EVIDENCIA_${index + 1}`,
    fuente: item.source,
    tipo: item.sourceType,
    titulo: clip(item.title, 180),
    url: item.url,
    fecha: item.date,
    fragmento: clip(item.fragment, 650),
    confianza: item.confidence,
  }));

  return JSON.stringify(
    {
      instruccion_obligatoria: retrieval.instruction,
      consulta_generica: retrieval.query,
      evidencia_filtrada: sources,
    },
    null,
    2,
  );
}

function formatMedicalReasoning(reasoning: MedicalReasoningContext): string {
  return JSON.stringify(
    {
      instruccion_obligatoria: reasoning.instruction,
      especialidad: reasoning.specialty,
      severidad: reasoning.severity,
      secciones_obligatorias: reasoning.requiredSections,
      guia_especialidad: reasoning.specialtyGuidance,
      escalamiento_urgencia: reasoning.emergencyEscalation,
      politica_evidencia: reasoning.evidencePolicy,
      fallback: reasoning.fallback,
      errores: reasoning.errors,
    },
    null,
    2,
  );
}

function formatMedicalSpecialtyProtocol(protocol: MedicalSpecialtyProtocolContext): string {
  return JSON.stringify(
    {
      instruccion_obligatoria: protocol.instruction,
      especialidad: protocol.specialty,
      etiqueta: protocol.label,
      nivel_riesgo: protocol.riskLevel,
      tono: protocol.tone,
      estilo_razonamiento: protocol.reasoningStyle,
      focos_protocolo: protocol.protocolFocus,
      red_flags: protocol.redFlags,
      politica_evidencia: protocol.evidencePolicy,
      estructura_clinica: protocol.structureHints,
      modificadores_riesgo: protocol.riskModifiers,
      modificadores_urgencia: protocol.emergencyModifiers,
      compatibilidad: protocol.compatibility,
      fallback: protocol.fallback,
      errores: protocol.errors,
    },
    null,
    2,
  );
}

function buildMessages(input: MetaBrainDecisionInput): GroqChatMessage[] {
  const historyMessages = input.context.conversation_history.slice(-8).flatMap<GroqChatMessage>((entry) => [
    {
      role: "user",
      content: clip(entry.doctor_message, 1200),
    },
    {
      role: "assistant",
      content: clip(entry.response, 1200),
    },
  ]);
  const medicalConversationMemory = getMedicalConversationMemory(input.context);
  const memoryMessage: GroqChatMessage[] = medicalConversationMemory
    ? [
        {
          role: "user",
          content: `MEMORIA CLINICA CONVERSACIONAL:\n${formatMedicalConversationMemory(medicalConversationMemory)}`,
        },
      ]
    : [];
  const doctorProfileContext = getDoctorProfileContext(input.context);
  const doctorProfileMessage: GroqChatMessage[] = doctorProfileContext
    ? [
        {
          role: "user",
          content: `DOCTOR PROFILE CONTEXT:\n${formatDoctorProfileContext(doctorProfileContext)}`,
        },
      ]
    : [];
  const medicalRuntimeContext = getMedicalRuntimeContext(input.context);
  const runtimeMessage: GroqChatMessage[] = medicalRuntimeContext
    ? [
        {
          role: "user",
          content: `RUNTIME CONTEXT:\n${formatMedicalRuntimeContext(medicalRuntimeContext)}`,
        },
      ]
    : [];
  const medicalWebRetrieval = getMedicalWebRetrievalContext(input.context);
  const evidenceMessage: GroqChatMessage[] = medicalWebRetrieval
    ? [
        {
          role: "user",
          content: `EVIDENCIA MEDICA EXTERNA CONTROLADA:\n${formatMedicalWebEvidence(medicalWebRetrieval)}`,
        },
      ]
    : [];
  const medicalReasoning = getMedicalReasoningContext(input.context);
  const reasoningMessage: GroqChatMessage[] = medicalReasoning
    ? [
        {
          role: "user",
          content: `STRUCTURED MEDICAL REASONING:\n${formatMedicalReasoning(medicalReasoning)}`,
        },
      ]
    : [];
  const medicalSpecialtyProtocol = getMedicalSpecialtyProtocolContext(input.context);
  const specialtyProtocolMessage: GroqChatMessage[] = medicalSpecialtyProtocol
    ? [
        {
          role: "user",
          content: `SPECIALTY MEDICAL PROTOCOL:\n${formatMedicalSpecialtyProtocol(medicalSpecialtyProtocol)}`,
        },
      ]
    : [];

  return [
    {
      role: "system",
      content: buildSystemPrompt(),
    },
    {
      role: "user",
      content: `Contexto clinico disponible:\n${formatContext(input.context)}`,
    },
    ...doctorProfileMessage,
    ...memoryMessage,
    ...runtimeMessage,
    ...evidenceMessage,
    ...specialtyProtocolMessage,
    ...reasoningMessage,
    ...historyMessages,
    {
      role: "user",
      content: input.message,
    },
  ];
}

function normalizeGroqText(value: unknown): string {
  return String(value ?? "").trim();
}

export function isGroqDoctorChatConfigured(): boolean {
  return getConfig().enabled;
}

export async function callGroqDoctorChat(input: MetaBrainDecisionInput): Promise<MetaBrainDecision | null> {
  const config = getConfig();
  if (!config.enabled) {
    return null;
  }

  if (!config.baseUrl || !config.model) {
    logServer("warn", "doctor_chat.groq.invalid_config", {
      has_base_url: Boolean(config.baseUrl),
      has_model: Boolean(config.model),
    });
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages(input),
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logServer("warn", "doctor_chat.groq.http_error", {
        status: response.status,
        model: config.model,
        body: body.slice(0, 240),
      });
      return null;
    }

    const data = (await response.json()) as GroqChatResponse;
    const content = normalizeGroqText(data.choices?.[0]?.message?.content);
    if (!content) {
      logServer("warn", "doctor_chat.groq.empty_response", {
        model: data.model ?? config.model,
      });
      return null;
    }

    return {
      action: "GROQ_FREE_CHAT",
      response: content,
      confidence: 0.92,
      source: "GROQ",
    };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "request_failed";
    logServerError("doctor_chat.groq.failed", error, {
      reason,
      model: config.model,
      timeout_ms: config.timeoutMs,
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
