import { z } from "zod";

import { logServer } from "@/lib/server-logger";
import { isDocumentAIEnabled } from "@/lib/document-ai";
import { renderDicomToPng } from "@/medical-imaging/dicom-renderer.service";
import type { MedicalImagingAnalysis, MedicalRegion, MedicalStudyType } from "@/medical-imaging/imaging.service";

const DEFAULT_DOCUMENT_AI_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const medicalImagingVisionSchema = z
  .object({
    study_type: z.enum(["MRI", "CT", "XRAY", "DICOM", "UNKNOWN"]).default("UNKNOWN"),
    region: z.enum(["knee", "shoulder", "spine", "head", "chest", "unknown"]).default("unknown"),
    quality: z.enum(["high", "medium", "low"]).default("low"),
    findings: z.array(z.string().trim().min(1).max(220)).max(8).default([]),
    condition: z.string().trim().max(220).default("no concluyente"),
    probability: z.number().min(0).max(1).default(0.5),
    technical_description: z.string().trim().max(600).default(""),
    limitations: z.string().trim().max(600).default(""),
    recommendation: z.string().trim().max(600).default(""),
    confidence_score: z.number().min(0).max(1).default(0.5),
  })
  .strict();

const MEDICAL_IMAGING_PROMPT = [
  "Analiza esta imagen medica renderizada para apoyo clinico no diagnostico.",
  "Puede ser RMN, tomografia, radiografia o captura de un estudio.",
  "No inventes hallazgos no visibles. Si la imagen no permite concluir, indicalo.",
  "No reemplaces el informe radiologico ni el criterio medico.",
  "Responde solo JSON estricto con:",
  "study_type, region, quality, findings, condition, probability, technical_description, limitations, recommendation, confidence_score.",
  "Usa findings breves y conservadores. Si no hay evidencia suficiente, findings debe incluir 'no concluyente'.",
].join(" ");

function parseInteger(value: string | undefined, defaultValue: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

function inferProvider(): "groq" {
  return "groq";
}

function buildConfig() {
  const model = String(process.env.DOCUMENT_AI_MODEL ?? DEFAULT_DOCUMENT_AI_MODEL).trim() || DEFAULT_DOCUMENT_AI_MODEL;
  const envBaseUrl = String(process.env.DOCUMENT_AI_BASE_URL ?? "").trim();
  const provider = inferProvider();
  const baseUrl = (envBaseUrl || DEFAULT_GROQ_BASE_URL).replace(/\/+$/, "");

  return {
    provider,
    baseUrl,
    model,
    apiKey: String(process.env.DOCUMENT_AI_API_KEY ?? process.env.GROQ_API_KEY ?? "").trim(),
    timeoutMs: parseInteger(process.env.DOCUMENT_AI_TIMEOUT_MS, 25_000, 3_000, 120_000),
    maxRetries: parseInteger(process.env.DOCUMENT_AI_MAX_RETRIES, 2, 0, 5),
  };
}

function isVisionMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  return normalized.startsWith("image/") && !normalized.includes("dicom");
}

async function fileToDataUrl(file: File, mimeType: string): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${mimeType || "image/jpeg"};base64,${bytes.toString("base64")}`;
}

function buildGroqBody(model: string, dataUrl: string) {
  return {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: MEDICAL_IMAGING_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0,
  };
}

function extractProviderText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as Record<string, unknown>;
  if (typeof data.output_text === "string") return data.output_text;

  const choices = data.choices;
  if (Array.isArray(choices)) {
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === "string") return message.content;
  }

  const output = data.output;
  if (Array.isArray(output)) {
    const chunks = output
      .flatMap((item) => {
        const content = (item as Record<string, unknown>)?.content;
        return Array.isArray(content) ? content : [];
      })
      .map((item) => {
        const record = item as Record<string, unknown>;
        return typeof record.text === "string" ? record.text : "";
      })
      .filter(Boolean);
    return chunks.join("\n");
  }

  return "";
}

function extractJsonText(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
  return trimmed;
}

async function fetchVisionAI(url: string, body: unknown, apiKey: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`MEDICAL_IMAGING_AI_PROVIDER_ERROR ${response.status}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function toAnalysis(raw: z.infer<typeof medicalImagingVisionSchema>): MedicalImagingAnalysis {
  const findings = raw.findings.length > 0 ? raw.findings : ["no concluyente"];
  return {
    type: raw.study_type as MedicalStudyType,
    region: raw.region as MedicalRegion,
    quality: raw.quality,
    findings,
    condition: raw.condition || findings[0] || "no concluyente",
    probability: Number(raw.probability.toFixed(2)),
    technical_description: raw.technical_description || "Analisis visual asistido sobre imagen aislada.",
    limitations:
      raw.limitations ||
      "Analisis visual asistido sobre una imagen renderizada; no reemplaza informe radiologico ni estudio completo.",
    recommendation:
      raw.recommendation ||
      "Correlacionar con el estudio completo, antecedentes clinicos e informe radiologico formal.",
    confidence: Number(raw.confidence_score.toFixed(2)),
    pipeline: "ai-vision-v1",
    model_key: "document-ai-vision",
    model_version: buildConfig().model,
    notes: "Analisis visual asistido por proveedor IA configurado; no diagnostico definitivo.",
  };
}

export async function analyzeMedicalImageWithVisionAI(file: File, mimeType: string): Promise<MedicalImagingAnalysis | null> {
  if (!isDocumentAIEnabled()) return null;

  const config = buildConfig();
  if (!config.apiKey) {
    logServer("warn", "medical_imaging.ai_vision_missing_api_key", { provider: config.provider });
    return null;
  }

  const renderedDicom = await renderDicomToPng(file, mimeType);
  if (!isVisionMimeType(mimeType) && !renderedDicom) return null;

  const dataUrl = renderedDicom
    ? `data:${renderedDicom.mimeType};base64,${renderedDicom.buffer.toString("base64")}`
    : await fileToDataUrl(file, mimeType);
  const url = `${config.baseUrl}/chat/completions`;
  const body = buildGroqBody(config.model, dataUrl);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      const payload = await fetchVisionAI(url, body, config.apiKey, config.timeoutMs);
      const text = extractProviderText(payload);
      if (!text.trim()) throw new Error("MEDICAL_IMAGING_AI_EMPTY_RESPONSE");
      const parsed = medicalImagingVisionSchema.parse(JSON.parse(extractJsonText(text)));
      return toAnalysis(parsed);
    } catch (error) {
      lastError = error;
      if (attempt >= config.maxRetries) break;
    }
  }

  logServer("warn", "medical_imaging.ai_vision_failed", {
    provider: config.provider,
    model: config.model,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  return null;
}
