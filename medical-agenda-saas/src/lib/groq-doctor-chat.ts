import "server-only";

import { logServer, logServerError } from "@/lib/server-logger";
import type { MetaBrainDecision, MetaBrainDecisionInput } from "@/lib/metabrain";

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
  const directKey = (process.env.DOCTOR_CHAT_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? "").trim();
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
    "Eres un asistente clinico para un medico dentro de un sistema de agenda medica.",
    "El chat es libre: responde la consulta real del medico sin forzar intents ni flujos cerrados.",
    "Usa el contexto del paciente solo cuando este disponible y sea relevante.",
    "Si el contexto incluye metadata.agenda, tenes acceso de lectura a esa agenda: usala para orientar disponibilidad, medicos y horarios reales.",
    "No inventes horarios: si no hay open_slots o reglas suficientes, pedi confirmacion con secretaria o solicita mas datos.",
    "No inventes datos clinicos, estudios, antecedentes, dosis ni resultados. Si falta informacion, dilo.",
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
        phone: context.patient.phone,
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

  return [
    {
      role: "system",
      content: buildSystemPrompt(),
    },
    {
      role: "user",
      content: `Contexto clinico disponible:\n${formatContext(input.context)}`,
    },
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
