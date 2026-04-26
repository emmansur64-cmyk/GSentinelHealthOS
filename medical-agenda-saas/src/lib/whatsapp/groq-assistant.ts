import { logServer, logServerError } from "@/lib/server-logger";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

type WhatsAppGroqConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
};

type WhatsAppGroqResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  model?: string;
};

type WhatsAppGroqInput = {
  text: string;
  context?: Record<string, unknown>;
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

function resolveApiKey(): string {
  const directKey = (process.env.WHATSAPP_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? "").trim();
  if (directKey) return directKey;

  const documentBaseUrl = String(process.env.DOCUMENT_AI_BASE_URL ?? "").toLowerCase();
  const documentProvider = String(process.env.DOCUMENT_AI_PROVIDER ?? "").toLowerCase();
  if (documentProvider === "groq" || documentBaseUrl.includes("api.groq.com")) {
    return (process.env.DOCUMENT_AI_API_KEY ?? "").trim();
  }

  return "";
}

function getConfig(): WhatsAppGroqConfig {
  const apiKey = resolveApiKey();
  return {
    enabled: parseBoolean(process.env.WHATSAPP_GROQ_ENABLED, true) && Boolean(apiKey),
    apiKey,
    baseUrl: stripTrailingSlash(
      (process.env.WHATSAPP_GROQ_BASE_URL ?? process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1").trim(),
    ),
    model:
      (process.env.WHATSAPP_GROQ_MODEL ??
        process.env.GROQ_MODEL ??
        process.env.NLG_GROQ_MODEL ??
        "llama-3.3-70b-versatile").trim(),
    temperature: parseNumber(process.env.WHATSAPP_GROQ_TEMPERATURE, 0.1, 0, 2),
    maxTokens: parseInteger(process.env.WHATSAPP_GROQ_MAX_TOKENS, 220, 64, 1000),
    timeoutMs: parseInteger(process.env.WHATSAPP_GROQ_TIMEOUT_MS, 8_000, 2_000, 30_000),
  };
}

function buildSystemPrompt(): string {
  return [
    "Sos el asistente de WhatsApp de una agenda medica.",
    "Tu funcion es ayudar al paciente a entender como pedir, consultar, cancelar o reprogramar turnos.",
    "No confirmes turnos, horarios, medicos ni disponibilidad. Eso lo hace el sistema con reglas.",
    "No des diagnosticos ni tratamiento medico.",
    "Si el mensaje no es claro, pedi una aclaracion breve.",
    "Responde en espanol, en formato apto para WhatsApp, sin markdown complejo.",
    "No menciones Groq, modelos ni IA.",
  ].join(" ");
}

export async function generateWhatsAppGroqReply(input: WhatsAppGroqInput): Promise<string | null> {
  const config = getConfig();
  if (!config.enabled) return null;

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
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          {
            role: "user",
            content: JSON.stringify({
              message: input.text,
              context: input.context ?? {},
            }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logServer("warn", "whatsapp.groq.http_error", {
        status: response.status,
        model: config.model,
        body: body.slice(0, 200),
      });
      return null;
    }

    const data = (await response.json()) as WhatsAppGroqResponse;
    const content = String(data.choices?.[0]?.message?.content ?? "").trim();
    return content || null;
  } catch (error) {
    logServerError("whatsapp.groq.failed", error, {
      model: config.model,
      timeout_ms: config.timeoutMs,
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
