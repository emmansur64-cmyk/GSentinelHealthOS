import { z } from "zod";
import sharp from "sharp";

import { logServer } from "@/lib/server-logger";

const documentVisionSchema = z
  .object({
    document_type: z.string().trim().min(1).max(120),
    language: z.string().trim().min(2).max(40),
    readability: z.enum(["high", "medium", "low"]),
    confidence_score: z.number().min(0).max(1).optional(),
    doctor_name: z.string().trim().max(200).default(""),
    specialty: z.string().trim().max(120).default(""),
    license_number: z.string().trim().max(80).default(""),
    month: z.string().trim().max(40).default(""),
    year: z.string().trim().max(10).default(""),
    schedule: z
      .object({
        lunes: z.array(z.string().trim().max(80)),
        martes: z.array(z.string().trim().max(80)),
        miercoles: z.array(z.string().trim().max(80)),
        jueves: z.array(z.string().trim().max(80)),
        viernes: z.array(z.string().trim().max(80)),
        sabado: z.array(z.string().trim().max(80)),
        domingo: z.array(z.string().trim().max(80)),
      })
      .strict(),
  })
  .strict();

type VisionDocumentExtractionRaw = z.infer<typeof documentVisionSchema>;

export type VisionDocumentExtraction = Omit<VisionDocumentExtractionRaw, "confidence_score"> & {
  confidence_score: number;
  raw_summary?: string;
  parse_mode?: "strict_json" | "loose_text";
};

export type DocumentAIConfigOverrides = {
  provider?: "openai" | "groq";
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxImagePixels?: number;
  maxImageEdge?: number;
};

type ScheduleKey = keyof VisionDocumentExtractionRaw["schedule"];

const SCHEDULE_KEYS: ScheduleKey[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const SCHEDULE_KEY_TO_INDEX: Record<ScheduleKey, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};
const DAY_ALIASES: Array<{ key: ScheduleKey; terms: string[] }> = [
  { key: "lunes", terms: ["lunes", "lun"] },
  { key: "martes", terms: ["martes", "mar"] },
  { key: "miercoles", terms: ["miercoles", "miércoles", "mie", "mié"] },
  { key: "jueves", terms: ["jueves", "jue"] },
  { key: "viernes", terms: ["viernes", "vie"] },
  { key: "sabado", terms: ["sabado", "sábado", "sab"] },
  { key: "domingo", terms: ["domingo", "dom"] },
];
const DEFAULT_DOCUMENT_AI_MODEL = "gpt-4.1";
const DEFAULT_DOCUMENT_AI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DOCUMENT_AI_PROMPT = [
  "Analiza la imagen de una planilla mensual de agenda medica.",
  "Extrae solamente datos verificables visibles en la imagen.",
  "Lee con prioridad los campos impresos y manuscritos del encabezado: Nombre del Medico, Especialidad, Matricula, Mes y Anio.",
  "Si una palabra manuscrita es dudosa, transcribila igual con baja confianza antes que omitirla; no inventes datos que no esten visibles.",
  "En la grilla, cada texto escrito dentro de una columna corresponde al dia de esa columna.",
  "Responde en JSON estricto con estas claves:",
  "document_type, language, readability, confidence_score, doctor_name, specialty, license_number, month, year, schedule.",
  "schedule debe contener lunes, martes, miercoles, jueves, viernes, sabado y domingo como arrays de rangos horarios.",
  "Usa rangos como 08:00-12:00 cuando sea posible. Si no hay datos, usa string vacio o arrays vacios.",
].join(" ");

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeTimeComponent(hourRaw: string, minuteRaw?: string): string | null {
  const hour = Number(hourRaw);
  const minute = Number(typeof minuteRaw === "string" && minuteRaw.length > 0 ? minuteRaw : "0");
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function extractTimeRanges(value: string): string[] {
  const raw = value.trim();
  if (!raw) return [];

  const cleaned = raw
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/\bhs\b/g, "")
    .replace(/\bhoras\b/g, "")
    .replace(/\bh\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const ranges: string[] = [];
  const pattern = /(?:de\s+)?(\d{1,2})(?::(\d{1,2}))?\s*(?:a|hasta|to|-)\s*(\d{1,2})(?::(\d{1,2}))?/gi;
  for (const match of cleaned.matchAll(pattern)) {
    const start = normalizeTimeComponent(match[1], match[2]);
    const end = normalizeTimeComponent(match[3], match[4]);
    if (!start || !end) continue;
    const normalized = `${start}-${end}`;
    if (!ranges.includes(normalized)) ranges.push(normalized);
  }

  return ranges;
}

function normalizeTimeRange(value: string): string {
  return extractTimeRanges(value)[0] ?? "";
}

function createEmptySchedule(): VisionDocumentExtractionRaw["schedule"] {
  return {
    lunes: [],
    martes: [],
    miercoles: [],
    jueves: [],
    viernes: [],
    sabado: [],
    domingo: [],
  };
}

function findDayKeyInText(value: string): ScheduleKey | null {
  const normalized = normalizeText(value);
  for (const item of DAY_ALIASES) {
    if (item.terms.some((term) => new RegExp(`\\b${normalizeText(term)}\\b`, "i").test(normalized))) {
      return item.key;
    }
  }
  return null;
}

function expandDayRange(from: ScheduleKey, to: ScheduleKey): ScheduleKey[] {
  const start = SCHEDULE_KEY_TO_INDEX[from];
  const end = SCHEDULE_KEY_TO_INDEX[to];
  if (start <= end) {
    return SCHEDULE_KEYS.filter((key) => SCHEDULE_KEY_TO_INDEX[key] >= start && SCHEDULE_KEY_TO_INDEX[key] <= end);
  }
  return SCHEDULE_KEYS.filter((key) => SCHEDULE_KEY_TO_INDEX[key] >= start || SCHEDULE_KEY_TO_INDEX[key] <= end);
}

function addScheduleEntries(
  schedule: VisionDocumentExtractionRaw["schedule"],
  key: ScheduleKey,
  entries: string[],
) {
  for (const entry of entries) {
    if (!schedule[key].includes(entry)) schedule[key].push(entry);
  }
}

function extractScheduleFromRawText(rawText: string): VisionDocumentExtractionRaw["schedule"] {
  const schedule = createEmptySchedule();
  const lines = rawText
    .split(/\r?\n|[;|]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const ranges = extractTimeRanges(line);
    if (ranges.length === 0) continue;

    const normalizedLine = normalizeText(line);
    const dayRangeMatch = normalizedLine.match(
      /\b(lunes|lun|martes|mar|miercoles|mie|jueves|jue|viernes|vie|sabado|sab|domingo|dom)\b\s*(?:a|al|hasta|-)\s*\b(lunes|lun|martes|mar|miercoles|mie|jueves|jue|viernes|vie|sabado|sab|domingo|dom)\b/i,
    );

    if (dayRangeMatch?.[1] && dayRangeMatch?.[2]) {
      const from = findDayKeyInText(dayRangeMatch[1]);
      const to = findDayKeyInText(dayRangeMatch[2]);
      if (from && to) {
        for (const key of expandDayRange(from, to)) {
          addScheduleEntries(schedule, key, ranges);
        }
        continue;
      }
    }

    for (const item of DAY_ALIASES) {
      if (item.terms.some((term) => new RegExp(`\\b${normalizeText(term)}\\b`, "i").test(normalizedLine))) {
        addScheduleEntries(schedule, item.key, ranges);
      }
    }
  }

  return schedule;
}

function normalizeSchedule(schedule: VisionDocumentExtractionRaw["schedule"]) {
  const normalizedSchedule = {
    lunes: [] as string[],
    martes: [] as string[],
    miercoles: [] as string[],
    jueves: [] as string[],
    viernes: [] as string[],
    sabado: [] as string[],
    domingo: [] as string[],
  };

  let totalEntries = 0;
  let normalizedEntries = 0;
  const seenByDay = new Map<ScheduleKey, Set<string>>(
    SCHEDULE_KEYS.map((key) => [key, new Set<string>()]),
  );

  for (const key of SCHEDULE_KEYS) {
    for (const value of schedule[key]) {
      totalEntries += 1;
      const normalized = normalizeTimeRange(value);
      if (!normalized) continue;
      const seen = seenByDay.get(key);
      if (seen?.has(normalized)) continue;
      seen?.add(normalized);
      normalizedEntries += 1;
      normalizedSchedule[key].push(normalized);
    }
  }

  return {
    schedule: normalizedSchedule,
    totalEntries,
    normalizedEntries,
  };
}

function deriveConfidenceScore(raw: VisionDocumentExtractionRaw, totalEntries: number, normalizedEntries: number): number {
  const readabilityBase = raw.readability === "high" ? 0.88 : raw.readability === "medium" ? 0.7 : 0.45;
  const coverageDays = SCHEDULE_KEYS.filter((key) => raw.schedule[key].length > 0).length;
  const coverageScore = coverageDays / SCHEDULE_KEYS.length;
  const normalizationScore = totalEntries > 0 ? normalizedEntries / totalEntries : 0.5;

  let completenessBoost = 0;
  if (raw.doctor_name.trim()) completenessBoost += 0.05;
  if (raw.specialty.trim()) completenessBoost += 0.04;
  if (raw.license_number.trim()) completenessBoost += 0.04;
  if (raw.month.trim() && raw.year.trim()) completenessBoost += 0.04;

  const computed = clamp01(readabilityBase * 0.55 + coverageScore * 0.2 + normalizationScore * 0.12 + completenessBoost);
  if (typeof raw.confidence_score !== "number") {
    return toTwoDecimals(computed);
  }

  const blended = clamp01(raw.confidence_score * 0.65 + computed * 0.35);
  return toTwoDecimals(blended);
}

function extractField(rawText: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match?.[1]) return String(match[1]).trim();
  }
  return "";
}

export function buildLooseVisionFallbackFromRawText(rawText: string): VisionDocumentExtraction {
  const normalized = normalizeText(rawText);
  const readability: "high" | "medium" | "low" = rawText.length > 700 ? "high" : rawText.length > 260 ? "medium" : "low";
  const schedule = extractScheduleFromRawText(rawText);
  const scheduleEntries = SCHEDULE_KEYS.reduce((total, key) => total + schedule[key].length, 0);

  let documentType = "medical_document";
  if (/(resonancia|mri|rmn|tomografia|tac|radiografia|rx|ecografia|ultrasonido)/i.test(normalized)) {
    documentType = "imaging_report";
  } else if (/(informe|diagnostico|hallazgo|conclusion)/i.test(normalized)) {
    documentType = "clinical_report";
  } else if (/(dni|documento|identidad)/i.test(normalized)) {
    documentType = "id_document";
  }

  const doctorName = extractField(rawText, [
    /nombre\s+del\s+m[eé]dico\s*[:\-]?\s*([^\n\r]+)/i,
    /nombre\s+profesional\s*[:\-]?\s*([^\n\r]+)/i,
    /(?:doctor|dra\.?|dr\.?|medico)\s*[:\-]\s*([^\n\r]+)/i,
    /firmado\s+por\s*[:\-]?\s*([^\n\r]+)/i,
  ]);

  const specialty = extractField(rawText, [
    /(?:especialidad|servicio|profesion|profesi[oó]n)\s*[:\-]?\s*([^\n\r]+)/i,
  ]);

  const license = extractField(rawText, [
    /(?:matricula|matr[ií]cula|licencia|registro|mn|mp)\s*[:#\-]?\s*([A-Za-z0-9.\-]+)/i,
  ]);

  const month = extractField(rawText, [
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i,
  ]);

  const year = extractField(rawText, [/\b(20\d{2}|19\d{2})\b/]);

  return {
    document_type: documentType,
    language: /[a-zA-Z]/.test(rawText) ? "es" : "es",
    readability,
    confidence_score: toTwoDecimals(scheduleEntries > 0 ? 0.68 : rawText.length > 260 ? 0.62 : 0.45),
    doctor_name: doctorName,
    specialty,
    license_number: license,
    month,
    year,
    schedule,
    raw_summary: rawText,
    parse_mode: "loose_text",
  };
}

export function isVisionSupportedMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string" || value.trim() === "") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseInteger(value: string | undefined, defaultValue: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

function inferDocumentAIProvider(baseUrl: string, model: string, explicitProvider?: string): "openai" | "groq" {
  if (explicitProvider === "groq" || explicitProvider === "openai") return explicitProvider;

  const envProvider = String(process.env.DOCUMENT_AI_PROVIDER ?? "").trim().toLowerCase();
  if (envProvider === "groq" || envProvider === "openai") return envProvider;

  const normalizedBaseUrl = baseUrl.toLowerCase();
  const normalizedModel = model.toLowerCase();
  if (normalizedBaseUrl.includes("groq") || normalizedModel.includes("llama") || normalizedModel.includes("meta-llama")) {
    return "groq";
  }
  return "openai";
}

function buildDocumentAIConfig(overrides: DocumentAIConfigOverrides = {}) {
  const model = String(overrides.model ?? process.env.DOCUMENT_AI_MODEL ?? DEFAULT_DOCUMENT_AI_MODEL).trim() || DEFAULT_DOCUMENT_AI_MODEL;
  const envBaseUrl = String(overrides.baseUrl ?? process.env.DOCUMENT_AI_BASE_URL ?? "").trim();
  const provisionalBaseUrl = envBaseUrl || DEFAULT_DOCUMENT_AI_BASE_URL;
  const provider = inferDocumentAIProvider(provisionalBaseUrl, model, overrides.provider);
  const baseUrl = envBaseUrl || (provider === "groq" ? DEFAULT_GROQ_BASE_URL : DEFAULT_DOCUMENT_AI_BASE_URL);
  const apiKey = String(overrides.apiKey ?? process.env.DOCUMENT_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();

  return {
    provider,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
    apiKey,
    timeoutMs: typeof overrides.timeoutMs === "number" ? Math.max(3_000, Math.min(120_000, overrides.timeoutMs)) : parseInteger(process.env.DOCUMENT_AI_TIMEOUT_MS, 25_000, 3_000, 120_000),
    maxRetries: typeof overrides.maxRetries === "number" ? Math.max(0, Math.min(5, overrides.maxRetries)) : parseInteger(process.env.DOCUMENT_AI_MAX_RETRIES, 2, 0, 5),
  };
}

export function isDocumentAIEnabled(): boolean {
  return parseBoolean(process.env.DOCUMENT_AI_ENABLED, false);
}

export function isDocumentAIRequired(): boolean {
  return parseBoolean(process.env.DOCUMENT_AI_REQUIRE_SUCCESS, false);
}

async function fileToDataUrl(file: File, overrides: DocumentAIConfigOverrides = {}): Promise<string> {
  const inputMimeType = String(file.type || "image/png").toLowerCase();
  const original = Buffer.from(await file.arrayBuffer());
  const maxImagePixels = typeof overrides.maxImagePixels === "number" ? overrides.maxImagePixels : 30_000_000;
  const maxImageEdge = typeof overrides.maxImageEdge === "number" ? overrides.maxImageEdge : 4096;

  try {
    const metadata = await sharp(original).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const pixels = width * height;

    if (width > maxImageEdge || height > maxImageEdge || pixels > maxImagePixels) {
      const pixelScale = pixels > maxImagePixels && pixels > 0 ? Math.sqrt(maxImagePixels / pixels) : 1;
      const edgeScale = Math.min(maxImageEdge / Math.max(width, 1), maxImageEdge / Math.max(height, 1), 1);
      const scale = Math.min(pixelScale, edgeScale, 1);
      const resizedWidth = Math.max(1, Math.floor(width * scale));
      const resizedHeight = Math.max(1, Math.floor(height * scale));

      const resized = await sharp(original)
        .rotate()
        .resize({
          width: resizedWidth,
          height: resizedHeight,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 88 })
        .toBuffer();

      logServer("info", "document_ai.image_resized", {
        original_width: width,
        original_height: height,
        resized_width: resizedWidth,
        resized_height: resizedHeight,
      });

      return `data:image/jpeg;base64,${resized.toString("base64")}`;
    }
  } catch (error) {
    logServer("warn", "document_ai.image_resize_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return `data:${inputMimeType};base64,${original.toString("base64")}`;
}

function extractJsonText(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
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
    if (chunks.length > 0) return chunks.join("\n");
  }

  return "";
}

function normalizeVisionExtraction(raw: unknown): VisionDocumentExtraction {
  const parsed = documentVisionSchema.parse(coerceVisionExtractionRaw(raw));
  const normalized = normalizeSchedule(parsed.schedule);
  const confidenceScore = deriveConfidenceScore(parsed, normalized.totalEntries, normalized.normalizedEntries);

  return {
    ...parsed,
    confidence_score: confidenceScore,
    schedule: normalized.schedule,
    parse_mode: "strict_json",
  };
}

function coerceString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function coerceConfidence(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return clamp01(value);
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return clamp01(parsed > 1 ? parsed / 100 : parsed);
  }
  return undefined;
}

function coerceReadability(value: unknown): "high" | "medium" | "low" {
  const normalized = normalizeText(coerceString(value));
  if (["high", "alta", "buena", "legible", "clara", "clear", "good"].includes(normalized)) return "high";
  if (["low", "baja", "mala", "ilegible", "poor", "bad"].includes(normalized)) return "low";
  return "medium";
}

function coerceScheduleEntries(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => coerceScheduleEntries(item))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,;\n\r]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const direct =
      record.horario ??
      record.horarios ??
      record.rango ??
      record.range ??
      record.time ??
      record.value ??
      record.text;
    if (direct) return coerceScheduleEntries(direct);

    const start = coerceString(record.start_time ?? record.start ?? record.desde);
    const end = coerceString(record.end_time ?? record.end ?? record.hasta);
    if (start && end) return [`${start}-${end}`];
  }

  return [];
}

function readScheduleValue(source: Record<string, unknown>, key: ScheduleKey): unknown {
  const aliases: Record<ScheduleKey, string[]> = {
    lunes: ["lunes", "monday", "lun"],
    martes: ["martes", "tuesday", "mar"],
    miercoles: ["miercoles", "miércoles", "wednesday", "mie", "mié"],
    jueves: ["jueves", "thursday", "jue"],
    viernes: ["viernes", "friday", "vie"],
    sabado: ["sabado", "sábado", "saturday", "sab"],
    domingo: ["domingo", "sunday", "dom"],
  };

  for (const alias of aliases[key]) {
    if (alias in source) return source[alias];
  }
  return [];
}

function coerceVisionExtractionRaw(raw: unknown): VisionDocumentExtractionRaw {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawSchedule = source.schedule && typeof source.schedule === "object"
    ? (source.schedule as Record<string, unknown>)
    : source;

  return {
    document_type: coerceString(readByAliases(source, ["document_type", "documentType", "tipo_documento", "tipo de documento"]), "planilla mensual de atencion medica"),
    language: coerceString(readByAliases(source, ["language", "idioma"]), "es") || "es",
    readability: coerceReadability(readByAliases(source, ["readability", "legibilidad", "quality", "calidad"])),
    confidence_score: coerceConfidence(readByAliases(source, ["confidence_score", "confidence", "score", "confianza"])),
    doctor_name: coerceString(readByAliases(source, ["doctor_name", "medico", "médico", "nombre_medico", "nombre médico", "nombre del medico", "nombre del médico", "professional_name"])),
    specialty: coerceString(readByAliases(source, ["specialty", "especialidad"])),
    license_number: coerceString(readByAliases(source, ["license_number", "matricula", "matrícula", "license"])),
    month: coerceString(readByAliases(source, ["month", "mes"])),
    year: coerceString(readByAliases(source, ["year", "anio", "año"])),
    schedule: {
      lunes: coerceScheduleEntries(readScheduleValue(rawSchedule, "lunes")),
      martes: coerceScheduleEntries(readScheduleValue(rawSchedule, "martes")),
      miercoles: coerceScheduleEntries(readScheduleValue(rawSchedule, "miercoles")),
      jueves: coerceScheduleEntries(readScheduleValue(rawSchedule, "jueves")),
      viernes: coerceScheduleEntries(readScheduleValue(rawSchedule, "viernes")),
      sabado: coerceScheduleEntries(readScheduleValue(rawSchedule, "sabado")),
      domingo: coerceScheduleEntries(readScheduleValue(rawSchedule, "domingo")),
    },
  };
}

function readByAliases(source: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (alias in source) return source[alias];
  }

  const normalizedAliases = new Set(aliases.map((alias) => normalizeText(alias).replace(/[^a-z0-9]+/g, "")));
  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = normalizeText(key).replace(/[^a-z0-9]+/g, "");
    if (normalizedAliases.has(normalizedKey)) return value;
  }

  return undefined;
}

function buildOpenAIResponsesBody(model: string, dataUrl: string) {
  return {
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: DOCUMENT_AI_PROMPT },
          { type: "input_image", image_url: dataUrl },
        ],
      },
    ],
  };
}

function buildChatCompletionsBody(model: string, dataUrl: string) {
  return {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: DOCUMENT_AI_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0,
  };
}

async function fetchDocumentAI(url: string, body: unknown, apiKey: string, timeoutMs: number): Promise<unknown> {
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
    if (!response.ok) {
      const providerError =
        payload && typeof payload === "object" && "error" in payload
          ? JSON.stringify((payload as { error?: unknown }).error)
          : response.statusText;
      if (response.status === 401 || /invalid_api_key|invalid api key|unauthorized/i.test(providerError)) {
        throw new Error("DOCUMENT_AI_INVALID_API_KEY");
      }
      throw new Error(`DOCUMENT_AI_PROVIDER_ERROR ${response.status}: ${providerError}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeImageDocumentWithAI(file: File, overrides: DocumentAIConfigOverrides = {}): Promise<VisionDocumentExtraction> {
  const config = buildDocumentAIConfig(overrides);
  if (!config.apiKey) {
    throw new Error("DOCUMENT_AI_API_KEY no configurada");
  }

  const mimeType = String(file.type ?? "").toLowerCase();
  if (!isVisionSupportedMimeType(mimeType)) {
    throw new Error(`DOCUMENT_AI_UNSUPPORTED_MIME_TYPE ${mimeType || "unknown"}`);
  }

  const dataUrl = await fileToDataUrl(file, overrides);
  const isGroq = config.provider === "groq";
  const url = isGroq ? `${config.baseUrl}/chat/completions` : `${config.baseUrl}/responses`;
  const body = isGroq ? buildChatCompletionsBody(config.model, dataUrl) : buildOpenAIResponsesBody(config.model, dataUrl);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      const payload = await fetchDocumentAI(url, body, config.apiKey, config.timeoutMs);
      const text = extractProviderText(payload);
      if (!text.trim()) throw new Error("DOCUMENT_AI_EMPTY_RESPONSE");
      return normalizeVisionExtraction(JSON.parse(extractJsonText(text)));
    } catch (error) {
      lastError = error;
      const canRetry = attempt < config.maxRetries;
      if (!canRetry) break;
    }
  }

  logServer("warn", "document_ai.analysis_failed", {
    provider: config.provider,
    model: config.model,
    error: sanitizeDocumentAIError(lastError),
  });

  throw lastError instanceof Error ? lastError : new Error("DOCUMENT_AI_ANALYSIS_FAILED");
}

function sanitizeDocumentAIError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  if (/invalid_api_key|invalid api key|unauthorized|401/i.test(value)) return "DOCUMENT_AI_INVALID_API_KEY";
  if (/api[_ -]?key/i.test(value)) return "DOCUMENT_AI_CREDENTIAL_ERROR";
  return value.slice(0, 300);
}
