import { z } from "zod";

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

type ScheduleKey = keyof VisionDocumentExtractionRaw["schedule"];

const SCHEDULE_KEYS: ScheduleKey[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

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

function normalizeTimeRange(value: string): string {
  const raw = value.trim();
  if (!raw) return "";

  const cleaned = raw
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/\bhs\b/g, "")
    .replace(/\bhoras\b/g, "")
    .replace(/\bh\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const match = cleaned.match(/(?:de\s+)?(\d{1,2})(?::(\d{1,2}))?\s*(?:a|hasta|to|-)\s*(\d{1,2})(?::(\d{1,2}))?/i);
  if (!match) return "";

  const start = normalizeTimeComponent(match[1], match[2]);
  const end = normalizeTimeComponent(match[3], match[4]);
  if (!start || !end) return "";

  return `${start}-${end}`;
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

  let documentType = "medical_document";
  if (/(resonancia|mri|rmn|tomografia|tac|radiografia|rx|ecografia|ultrasonido)/i.test(normalized)) {
    documentType = "imaging_report";
  } else if (/(informe|diagnostico|hallazgo|conclusion)/i.test(normalized)) {
    documentType = "clinical_report";
  } else if (/(dni|documento|identidad)/i.test(normalized)) {
    documentType = "id_document";
  }

  const doctorName = extractField(rawText, [
    /(?:doctor|dra\.?|dr\.?|medico)\s*[:\-]\s*([^\n\r]+)/i,
    /firmado\s+por\s*[:\-]?\s*([^\n\r]+)/i,
  ]);

  const specialty = extractField(rawText, [
    /(?:especialidad|servicio)\s*[:\-]\s*([^\n\r]+)/i,
  ]);

  const license = extractField(rawText, [
    /(?:matricula|licencia|registro)\s*[:\-]\s*([^\n\r]+)/i,
  ]);

  const month = extractField(rawText, [
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i,
  ]);

  const year = extractField(rawText, [/\b(20\d{2}|19\d{2})\b/]);

  return {
    document_type: documentType,
    language: /[a-zA-Z]/.test(rawText) ? "es" : "es",
    readability,
    confidence_score: toTwoDecimals(rawText.length > 260 ? 0.62 : 0.45),
    doctor_name: doctorName,
    specialty,
    license_number: license,
    month,
    year,
    schedule: {
      lunes: [],
      martes: [],
      miercoles: [],
      jueves: [],
      viernes: [],
      sabado: [],
      domingo: [],
    },
    raw_summary: rawText,
    parse_mode: "loose_text",
  };
}

export function isVisionSupportedMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
