import { z } from "zod";

import {
  AI_IMAGE_ANALYSIS_DOCTOR_NOTE,
  type AiImageAnalysisResult,
  type AiImageConfidence,
  type AiImageQualityStatus,
  type AiImageType,
} from "@/lib/ai-image-analysis-format";
import { getGroqImageAnalysisConfig } from "@/lib/env";

export type AiImageAnalysisRole = "doctor" | "secretary" | "admin";
export type AiImageAnalysisSource = "doctor_chat" | "secretary_panel";

export type AnalyzeMedicalImageInput = {
  tenantId: string;
  userId: string;
  role: AiImageAnalysisRole;
  imageBase64?: string;
  fileBuffer?: Buffer | Uint8Array;
  mimeType: string;
  source: AiImageAnalysisSource;
  optionalContext?: string;
};

export type DetectedMimeType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "unknown";

export class GroqImageAnalysisError extends Error {
  code: string;
  userMessage: string;
  status: number;

  constructor(code: string, userMessage = "No se pudo analizar la imagen. Verificá el formato o intentá nuevamente.", status = 400) {
    super(code);
    this.name = "GroqImageAnalysisError";
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
  }
}

const SYSTEM_PROMPT =
  "Sos un asistente de apoyo médico para análisis preliminar de imágenes. Tu función es describir hallazgos visibles, advertencias de calidad de imagen y sugerir puntos de revisión para un profesional matriculado. No emitas diagnóstico definitivo. No indiques tratamiento. No afirmes certezas clínicas si la imagen no permite confirmarlo. No reemplazás criterio médico. Si la imagen parece RMN, TAC, RX, ecografía, laboratorio escaneado o documento administrativo, adaptá el análisis al tipo de archivo. Respondé en español médico claro, estructurado y prudente.";

const imageTypes = ["RX", "TAC", "RMN", "ECO", "DOCUMENTO", "OTRO", "DESCONOCIDO"] as const;
const qualityStatuses = ["buena", "regular", "mala"] as const;
const confidences = ["baja", "media", "alta"] as const;

const analysisSchema = z.object({
  imageType: z.enum(imageTypes).catch("DESCONOCIDO"),
  quality: z
    .object({
      status: z.enum(qualityStatuses).catch("regular"),
      limitations: z.array(z.string()).catch([]),
    })
    .catch({ status: "regular", limitations: [] }),
  observations: z.array(z.string()).catch([]),
  possibleFindings: z.array(z.string()).catch([]),
  redFlags: z.array(z.string()).catch([]),
  recommendedNextSteps: z.array(z.string()).catch([]),
  doctorNote: z.string().catch(AI_IMAGE_ANALYSIS_DOCTOR_NOTE),
  confidence: z.enum(confidences).catch("baja"),
});

function toBuffer(input: AnalyzeMedicalImageInput): Buffer {
  if (input.fileBuffer) return Buffer.from(input.fileBuffer);
  if (input.imageBase64) {
    const cleaned = input.imageBase64.replace(/^data:[^;]+;base64,/, "").trim();
    return Buffer.from(cleaned, "base64");
  }
  throw new GroqImageAnalysisError("FILE_REQUIRED");
}

export function detectMimeType(buffer: Buffer): DetectedMimeType {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  return "unknown";
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function hasDangerousExtension(name: string): boolean {
  return /\.(?:bat|cmd|com|dll|exe|html?|js|mjs|php|ps1|sh|svg|vbs|wsf|zip)$/i.test(name);
}

function sanitizeContext(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  return value
    .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/g, "[email redactado]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[telefono redactado]")
    .replace(/\b(?:DNI|Documento|CUIL|CUIT)\s*[:#-]?\s*\d{6,11}\b/gi, "[documento redactado]")
    .slice(0, 1200);
}

function normalizeAnalysis(value: unknown): AiImageAnalysisResult {
  const parsed = analysisSchema.safeParse(value);
  if (!parsed.success) throw new GroqImageAnalysisError("AI_RESPONSE_INVALID");

  const data = parsed.data;
  return {
    imageType: data.imageType as AiImageType,
    quality: {
      status: data.quality.status as AiImageQualityStatus,
      limitations: data.quality.limitations.map(String).filter(Boolean).slice(0, 12),
    },
    observations: data.observations.map(String).filter(Boolean).slice(0, 20),
    possibleFindings: data.possibleFindings.map(String).filter(Boolean).slice(0, 20),
    redFlags: data.redFlags.map(String).filter(Boolean).slice(0, 12),
    recommendedNextSteps: data.recommendedNextSteps.map(String).filter(Boolean).slice(0, 12),
    doctorNote: AI_IMAGE_ANALYSIS_DOCTOR_NOTE,
    confidence: data.confidence as AiImageConfidence,
  };
}

function extractGroqText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return null;
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : null;
}

function extractJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new GroqImageAnalysisError("AI_RESPONSE_INVALID");
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  }
}

export async function analyzeMedicalImage(input: AnalyzeMedicalImageInput): Promise<AiImageAnalysisResult> {
  if (!input.tenantId?.trim()) throw new GroqImageAnalysisError("TENANT_REQUIRED", "No tenés permisos para realizar esta acción.", 403);
  if (!input.userId?.trim()) throw new GroqImageAnalysisError("USER_REQUIRED", "No tenés permisos para realizar esta acción.", 403);
  if (!["doctor", "secretary", "admin"].includes(input.role)) {
    throw new GroqImageAnalysisError("ROLE_FORBIDDEN", "No tenés permisos para realizar esta acción.", 403);
  }
  if (!["doctor_chat", "secretary_panel"].includes(input.source)) {
    throw new GroqImageAnalysisError("SOURCE_INVALID");
  }

  const config = getGroqImageAnalysisConfig();
  if (!config.apiKey) throw new GroqImageAnalysisError("GROQ_NOT_CONFIGURED", undefined, 503);

  const buffer = toBuffer(input);
  if (buffer.byteLength > config.maxBytes) {
    throw new GroqImageAnalysisError("FILE_TOO_LARGE", "El archivo supera el tamaño permitido.", 413);
  }

  const detectedMime = detectMimeType(buffer);
  if (detectedMime === "unknown" || detectedMime !== input.mimeType) {
    throw new GroqImageAnalysisError("MIME_INVALID");
  }
  if (detectedMime === "application/pdf") {
    throw new GroqImageAnalysisError("PDF_NOT_SUPPORTED");
  }

  const context = sanitizeContext(input.optionalContext);
  const dataUrl = `data:${detectedMime};base64,${buffer.toString("base64")}`;
  const userPrompt = [
    "Analizá la imagen adjunta con enfoque preliminar y prudente.",
    `Origen interno: ${input.source}.`,
    context ? `Contexto opcional redactado: ${context}` : null,
    "Respondé únicamente un objeto JSON con esta forma exacta:",
    '{"imageType":"RX|TAC|RMN|ECO|DOCUMENTO|OTRO|DESCONOCIDO","quality":{"status":"buena|regular|mala","limitations":[]},"observations":[],"possibleFindings":[],"redFlags":[],"recommendedNextSteps":[],"doctorNote":"texto","confidence":"baja|media|alta"}',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) throw new GroqImageAnalysisError("GROQ_REQUEST_FAILED", undefined, 502);

    const outputText = extractGroqText(payload);
    if (!outputText) throw new GroqImageAnalysisError("AI_RESPONSE_INVALID");

    return normalizeAnalysis(extractJsonObject(outputText));
  } catch (error) {
    if (error instanceof GroqImageAnalysisError) throw error;
    if (error instanceof SyntaxError) throw new GroqImageAnalysisError("AI_RESPONSE_INVALID");
    throw new GroqImageAnalysisError("GROQ_REQUEST_FAILED", undefined, 502);
  }
}

export const __aiImageAnalysisTest = {
  detectMimeType,
  hasDangerousExtension,
  normalizeAnalysis,
  sanitizeFilename,
};
