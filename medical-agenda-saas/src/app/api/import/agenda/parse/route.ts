import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";

import { ok, fail } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { DOCUMENT_ANALYSIS_SCHEMA_VERSION, safeValidateDocumentAnalysis } from "@/lib/document-analysis-schema";
import {
  analyzeImageDocumentWithAI,
  buildLooseVisionFallbackFromRawText,
  isVisionSupportedMimeType,
  type VisionDocumentExtraction,
} from "@/lib/document-ai";
import { buildAgendaImportGuidance } from "@/lib/metabrain";
import { publishMetaBrainSignal } from "@/lib/metabrain-bridge";
import { logServer } from "@/lib/server-logger";
import type { MedicalImagingAnalysis } from "@/medical-imaging/imaging.service";

type CandidateAppointment = {
  datetime: string;
  duration: number;
  status: "scheduled";
  source: "manual";
  notes: string;
  doctor_id?: string;
  patient_id?: string;
};

type CandidateAvailabilityRule = {
  doctor_id?: string;
  day_of_week: number;
  specific_date?: string;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

type OcrWorker = {
  recognize(image: Buffer): Promise<{ data: { text?: string | null } }>;
};

let agendaOcrWorkerPromise: Promise<OcrWorker> | null = null;

const DAY_KEY_TO_INDEX = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
} as const;

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function enrichAnalysisWithVision(
  analysis: ReturnType<typeof buildDocumentAnalysis>,
  extraction: VisionDocumentExtraction,
  rawText: string,
) {
  const scheduleEntries = [
    ...extraction.schedule.lunes,
    ...extraction.schedule.martes,
    ...extraction.schedule.miercoles,
    ...extraction.schedule.jueves,
    ...extraction.schedule.viernes,
    ...extraction.schedule.sabado,
    ...extraction.schedule.domingo,
  ].filter((value) => value.trim().length > 0);

  const readabilityScore = extraction.readability === "high" ? 0.9 : extraction.readability === "medium" ? 0.65 : 0.4;
  const qualityScore = Number((readabilityScore * 0.4 + extraction.confidence_score * 0.6).toFixed(2));
  const detectedSections = Array.from(
    new Set([
      ...analysis.detected_sections,
      "provider_information",
      ...(scheduleEntries.length > 0 ? ["schedule"] : []),
    ]),
  );

  const observations = [...analysis.observations];
  if (scheduleEntries.length === 0) {
    observations.push("La IA no detecto horarios concretos en la grilla");
  }

  return {
    ...analysis,
    document_type: extraction.document_type || analysis.document_type,
    language: extraction.language || analysis.language,
    quality: extraction.readability,
    quality_score: Number(qualityScore.toFixed(2)),
    detected_sections: detectedSections,
    raw_extracted_text: rawText,
    observations,
    provider: {
      ...analysis.provider,
      professional_name: extraction.doctor_name || analysis.provider.professional_name,
      license_number: extraction.license_number || analysis.provider.license_number,
      specialty: extraction.specialty || analysis.provider.specialty,
    },
    document_metadata: {
      ...analysis.document_metadata,
      issue_date:
        extraction.month && extraction.year
          ? `${extraction.month} ${extraction.year}`.trim()
          : analysis.document_metadata.issue_date,
    },
  };
}

function detectDocumentType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("resonancia") || t.includes("mri") || t.includes("rmn") || t.includes("tomografia") || t.includes("tac") || t.includes("radiografia") || t.includes("ecografia")) return "imaging_report";
  if (t.includes("receta") || t.includes("rx") || t.includes("prescripcion")) return "prescription";
  if (t.includes("laboratorio") || t.includes("resultado") || t.includes("hemograma")) return "lab_result";
  if (t.includes("informe") || t.includes("evolucion") || t.includes("diagnostico")) return "clinical_report";
  if (t.includes("factura") || t.includes("importe") || t.includes("subtotal")) return "invoice";
  if (t.includes("dni") || t.includes("documento") || t.includes("identidad")) return "id_document";
  return "medical_document";
}

function buildMedicalImagingNarrative(analysis: MedicalImagingAnalysis, fileName: string): string {
  return [
    `Tipo de estudio: ${analysis.type}`,
    `Region anatomica: ${analysis.region}`,
    `Calidad estimada: ${analysis.quality}`,
    `Descripcion tecnica: ${analysis.technical_description}`,
    `Hallazgos: ${analysis.findings.join(" | ")}`,
    `Limitaciones: ${analysis.limitations}`,
    `Recomendacion: ${analysis.recommendation}`,
    `Archivo: ${fileName}`,
  ].join("\n");
}

function extractClinicalInsights(rawText: string): {
  diagnoses: string[];
  imagingFindings: string[];
  recommendations: string[];
} {
  const text = rawText
    .replace(/\s+/g, " ")
    .trim();

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const imagingFindings = sentences
    .filter((part) => /(hallazgo|lesion|edema|hemorrag|fractura|coleccion|masa|contusion|desplazamiento|linea media)/i.test(part))
    .slice(0, 6);

  const diagnoses = sentences
    .filter((part) => /(diagnostic|impresion|compatible con|sugiere|conclusion)/i.test(part))
    .slice(0, 4);

  const recommendations = [
    ...sentences
      .filter((part) => /(recomienda|control|seguimiento|derivar|interconsulta|urgente|evaluar)/i.test(part))
      .slice(0, 4),
  ];

  if (recommendations.length === 0) {
    recommendations.push("Correlacionar con clinica, antecedentes y evaluacion medica presencial.");
  }

  return {
    diagnoses,
    imagingFindings,
    recommendations,
  };
}

function detectSections(text: string): string[] {
  const sections: string[] = [];
  const t = text.toLowerCase();
  if (t.includes("paciente")) sections.push("patient_information");
  if (t.includes("profesional") || t.includes("medico") || t.includes("doctor")) sections.push("provider_information");
  if (t.includes("diagnostico")) sections.push("diagnosis");
  if (t.includes("medic") || t.includes("tratamiento") || t.includes("indicacion")) sections.push("treatment");
  if (t.includes("firma")) sections.push("signature");
  if (t.includes("sello")) sections.push("stamp");
  return sections;
}

function buildDocumentAnalysis(rawText: string) {
  const detectedSections = detectSections(rawText);
  const insights = extractClinicalInsights(rawText);
  const qualityScore = Math.max(0, Math.min(1, rawText.length / 3000));
  const quality: "high" | "medium" | "low" = qualityScore > 0.75 ? "high" : qualityScore > 0.35 ? "medium" : "low";

  return {
    schema_version: DOCUMENT_ANALYSIS_SCHEMA_VERSION,
    document_type: detectDocumentType(rawText),
    language: "es",
    quality,
    quality_score: Number(qualityScore.toFixed(2)),
    orientation_correction_applied: false,
    detected_sections: detectedSections,
    raw_extracted_text: rawText,
    observations: quality === "low" ? ["Calidad de imagen o contenido limitada; revisar con estudio completo."] : [],
    patient: {
      full_name: "",
      document_id: "",
      dob: "",
      sex: "",
      age: null,
      insurance: "",
    },
    provider: {
      professional_name: "",
      license_number: "",
      specialty: "",
      facility_name: "",
      facility_id: "",
    },
    document_metadata: {
      document_id: "",
      issue_date: "",
      service_date: "",
      page_count: 1,
      currency: "",
      country: "",
    },
    clinical_content: {
      chief_complaint: "",
      diagnoses: insights.diagnoses.map((value) => ({
        code_system: "TEXT",
        code: "",
        description: value,
        confidence: Number(qualityScore.toFixed(2)),
      })),
      medications: [],
      allergies: [],
      vitals: {
        blood_pressure: "",
        heart_rate_bpm: null,
        temperature_c: null,
        respiratory_rate: null,
        oxygen_saturation_pct: null,
        weight_kg: null,
        height_cm: null,
      },
      lab_results: [],
      imaging_findings: insights.imagingFindings,
      recommendations: insights.recommendations,
      follow_up: {
        required: false,
        date: "",
        notes: "",
      },
    },
    administrative_content: {
      billing_items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      authorization_number: "",
      claim_number: "",
    },
    layout_analysis: {
      has_header: true,
      has_table: /\b(tabla|table)\b/i.test(rawText),
      has_signature: /\bfirma\b/i.test(rawText),
      has_stamp: /\bsello\b/i.test(rawText),
      has_qr_or_barcode: /\bqr\b|\bcodigo\s*de\s*barras\b/i.test(rawText),
      sections_with_coordinates: [],
    },
    security_and_risk: {
      contains_sensitive_data: true,
      possible_red_flags: [],
      tampering_suspected: false,
    },
    confidence: {
      overall: qualityScore,
      by_section: {
        patient: Number((qualityScore * 0.82).toFixed(2)),
        provider: Number((qualityScore * 0.9).toFixed(2)),
        clinical_content: Number((qualityScore * 0.84).toFixed(2)),
        administrative_content: Number((qualityScore * 0.75).toFixed(2)),
        layout_analysis: Number((qualityScore * 0.88).toFixed(2)),
      },
    },
  };
}

function buildMedicalImageDocumentAnalysis(rawText: string, imaging: MedicalImagingAnalysis) {
  const qualityScore = imaging.quality === "high" ? 0.82 : imaging.quality === "medium" ? 0.65 : 0.46;

  return {
    schema_version: DOCUMENT_ANALYSIS_SCHEMA_VERSION,
    document_type: "imaging_report",
    language: "es",
    quality: imaging.quality,
    quality_score: qualityScore,
    orientation_correction_applied: false,
    detected_sections: ["clinical_content", "imaging"],
    raw_extracted_text: rawText,
    observations: [
      "Analisis visual estructurado para imagen medica sin OCR.",
      imaging.limitations,
    ],
    patient: {
      full_name: "",
      document_id: "",
      dob: "",
      sex: "",
      age: null,
      insurance: "",
    },
    provider: {
      professional_name: "",
      license_number: "",
      specialty: "",
      facility_name: "",
      facility_id: "",
    },
    document_metadata: {
      document_id: "",
      issue_date: "",
      service_date: "",
      page_count: 1,
      currency: "",
      country: "",
    },
    clinical_content: {
      chief_complaint: "Analisis preliminar de imagen medica.",
      diagnoses: [
        {
          code_system: "STRUCTURED_IMAGING",
          code: imaging.type,
          description: `Estudio ${imaging.type} de region ${imaging.region}`,
          confidence: Number((qualityScore * 0.9).toFixed(2)),
        },
      ],
      medications: [],
      allergies: [],
      vitals: {
        blood_pressure: "",
        heart_rate_bpm: null,
        temperature_c: null,
        respiratory_rate: null,
        oxygen_saturation_pct: null,
        weight_kg: null,
        height_cm: null,
      },
      lab_results: [],
      imaging_findings: imaging.findings,
      recommendations: [imaging.recommendation],
      follow_up: {
        required: true,
        date: "",
        notes: imaging.limitations,
      },
    },
    administrative_content: {
      billing_items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      authorization_number: "",
      claim_number: "",
    },
    layout_analysis: {
      has_header: false,
      has_table: false,
      has_signature: false,
      has_stamp: false,
      has_qr_or_barcode: false,
      sections_with_coordinates: [],
    },
    security_and_risk: {
      contains_sensitive_data: false,
      possible_red_flags: [],
      tampering_suspected: false,
    },
    confidence: {
      overall: qualityScore,
      by_section: {
        patient: 0.2,
        provider: 0.2,
        clinical_content: Number((qualityScore * 0.95).toFixed(2)),
        administrative_content: 0.2,
        layout_analysis: Number((qualityScore * 0.8).toFixed(2)),
      },
    },
  };
}

function isDicomUpload(file: File, mimeType: string): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    lowerName.endsWith(".dcm") ||
    lowerName.endsWith(".dicom") ||
    mimeType.includes("dicom") ||
    (mimeType === "application/octet-stream" && (lowerName.includes("dicom") || lowerName.endsWith(".dcm")))
  );
}

function parseDateTimeFromText(rawText: string): Date[] {
  const candidates = new Set<number>();

  const reDateTime = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})/g;
  for (const match of rawText.matchAll(reDateTime)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const yearRaw = Number(match[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (!Number.isNaN(parsed.getTime())) candidates.add(parsed.getTime());
  }

  const reTimeOnly = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
  const now = new Date();
  for (const match of rawText.matchAll(reTimeOnly)) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const parsed = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (!Number.isNaN(parsed.getTime())) candidates.add(parsed.getTime());
  }

  return Array.from(candidates)
    .sort((a, b) => a - b)
    .map((ts) => new Date(ts));
}

function pickIdByTextMatch(rawText: string, candidates: Array<{ id: string; text: string }>): string | undefined {
  const lowered = rawText.toLowerCase();
  const found = candidates.find((candidate) => lowered.includes(candidate.text.toLowerCase()));
  return found?.id;
}

function normalizeLooseText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveMonthIndex(monthRaw: string): number | null {
  const normalized = normalizeLooseText(monthRaw);
  if (!normalized) return null;
  const direct = SPANISH_MONTHS[normalized];
  if (typeof direct === "number") return direct;

  const token = normalized.split(" ").find((part) => typeof SPANISH_MONTHS[part] === "number");
  return typeof token === "string" ? SPANISH_MONTHS[token] : null;
}

function resolveYear(yearRaw: string): number | null {
  const match = String(yearRaw).match(/\d{4}/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) ? parsed : null;
}

function getDatesForWeekdayInMonth(year: number, monthIndex: number, dayOfWeek: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(year, monthIndex, 1);

  while (cursor.getMonth() === monthIndex) {
    if (cursor.getDay() === dayOfWeek) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function extractTimeRange(value: string): { start_time: string; end_time: string } | null {
  const match = value.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!match) return null;

  return {
    start_time: match[1],
    end_time: match[2],
  };
}

function extractStructuredMedicalSheetHeader(rawText: string): {
  doctorName: string;
  specialty: string;
  licenseNumber: string;
  month: string;
  year: string;
} {
  let text = rawText
    .toLowerCase()
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ");

  text = text
    .replace(/aã\s*o/g, "año")
    .replace(/a\s*ã\s*o/g, "año")
    .replace(/\bano\b/g, "año")
    .replace(/m[eé]dico/g, "medico")
    .replace(/matr[ií]cula/g, "matricula")
    .replace(/mi[eé]rcoles/g, "miercoles")
    .replace(/s[áa]bado/g, "sabado")
    .replace(/nombre del medico\s*:/g, "nombre del medico ")
    .replace(/especialidad\s*:/g, "especialidad ")
    .replace(/matricula\s*:/g, "matricula ")
    .replace(/mes\s*:/g, "mes ")
    .replace(/año\s*:/g, "año ")
    .replace(/\s+/g, " ");

  const doctorName = text.match(/nombre del medico\s+(.+?)\s+especialidad/)?.[1]?.trim() ?? "";
  const specialty = text.match(/especialidad\s+(.+?)\s+matricula/)?.[1]?.trim() ?? "";
  const licenseNumber = text.match(/matricula\s+(\d+)/)?.[1]?.trim() ?? "";
  const month = text.match(/mes\s+([a-záéíóúñ]+)/)?.[1]?.trim() ?? "";
  const year = text.match(/mes\s+[a-záéíóúñ]+.*?(\d{4})/)?.[1]?.trim() ?? "";

  return {
    doctorName,
    specialty,
    licenseNumber,
    month,
    year,
  };
}

function findDoctorMatch(
  extraction: VisionDocumentExtraction | null,
  rawText: string,
  doctors: Array<{ user_id: string; matricula: string; user: { name: string } }>,
  agendaSettingsByUserId: Map<string, { appointment_duration: number }>,
): { doctorId?: string; slotDuration: number } {
  const structuredHeader = extractStructuredMedicalSheetHeader(rawText);

  const normalizedStructuredDoctorName = normalizeLooseText(structuredHeader.doctorName);
  const normalizedStructuredLicense = normalizeLooseText(structuredHeader.licenseNumber);
  const normalizedDoctorName = normalizeLooseText(extraction?.doctor_name ?? "");
  const normalizedLicense = normalizeLooseText(extraction?.license_number ?? "");
  const normalizedRawText = normalizeLooseText(rawText);

  const matched = doctors.find((doctor) => {
    const normalizedName = normalizeLooseText(doctor.user.name);
    const normalizedMatricula = normalizeLooseText(doctor.matricula ?? "");

    const licenseMatches =
      (normalizedStructuredLicense.length > 0 && normalizedMatricula === normalizedStructuredLicense) ||
      (normalizedLicense.length > 0 && normalizedMatricula === normalizedLicense);

    const structuredNameMatches =
      normalizedStructuredDoctorName.length > 0 &&
      (normalizedName.includes(normalizedStructuredDoctorName) || normalizedStructuredDoctorName.includes(normalizedName));

    const visionNameMatches =
      normalizedDoctorName.length > 0 &&
      (normalizedName.includes(normalizedDoctorName) || normalizedDoctorName.includes(normalizedName));

    const rawTextMatches = normalizedName.length > 0 && normalizedRawText.includes(normalizedName);
    const rawLicenseMatches = normalizedMatricula.length > 0 && normalizedRawText.includes(normalizedMatricula);

    return licenseMatches || structuredNameMatches || visionNameMatches || rawTextMatches || rawLicenseMatches;
  });

  return {
    doctorId: matched?.user_id,
    slotDuration: matched ? (agendaSettingsByUserId.get(matched.user_id)?.appointment_duration ?? 30) : 30,
  };
}

function buildAvailabilityRulesFromVision(
  extraction: VisionDocumentExtraction,
  doctorId: string | undefined,
  slotDuration: number,
): CandidateAvailabilityRule[] {
  const monthIndex = resolveMonthIndex(extraction.month);
  const year = resolveYear(extraction.year);
  const rules: CandidateAvailabilityRule[] = [];

  for (const [dayKey, dayIndex] of Object.entries(DAY_KEY_TO_INDEX)) {
    const entries = extraction.schedule[dayKey as keyof typeof extraction.schedule] ?? [];
    if (entries.length === 0) continue;

    const dates = monthIndex !== null && year !== null ? getDatesForWeekdayInMonth(year, monthIndex, dayIndex) : [];

    entries.forEach((entry, occurrenceIndex) => {
      const timeRange = extractTimeRange(entry);
      if (!timeRange) return;

      const specificDate = dates[occurrenceIndex];
      rules.push({
        doctor_id: doctorId,
        day_of_week: dayIndex,
        specific_date: specificDate ? specificDate.toISOString().slice(0, 10) : undefined,
        start_time: timeRange.start_time,
        end_time: timeRange.end_time,
        slot_duration: slotDuration,
      });
    });
  }

  return rules;
}

function mergeVisionExtractionWithFallback(
  primary: VisionDocumentExtraction,
  fallback: VisionDocumentExtraction,
): VisionDocumentExtraction {
  const schedule = { ...primary.schedule };
  for (const key of Object.keys(schedule) as Array<keyof VisionDocumentExtraction["schedule"]>) {
    if (schedule[key].length === 0 && fallback.schedule[key].length > 0) {
      schedule[key] = fallback.schedule[key];
    }
  }

  return {
    ...primary,
    doctor_name: primary.doctor_name || fallback.doctor_name,
    specialty: primary.specialty || fallback.specialty,
    license_number: primary.license_number || fallback.license_number,
    month: primary.month || fallback.month,
    year: primary.year || fallback.year,
    schedule,
    raw_summary: [primary.raw_summary, fallback.raw_summary].filter(Boolean).join("\n"),
  };
}

function needsAgendaHeaderFallback(extraction: VisionDocumentExtraction | null): boolean {
  if (!extraction) return false;
  return !extraction.doctor_name || !extraction.license_number || !extraction.specialty || !extraction.month || !extraction.year;
}

function buildAvailabilityRulesFromAppointments(appointments: CandidateAppointment[]): CandidateAvailabilityRule[] {
  const seen = new Set<string>();
  const rules: CandidateAvailabilityRule[] = [];

  for (const appointment of appointments) {
    const start = new Date(appointment.datetime);
    if (Number.isNaN(start.getTime())) continue;

    const duration = Number.isFinite(appointment.duration) && appointment.duration > 0 ? appointment.duration : 30;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const specificDate = start.toISOString().slice(0, 10);
    const startTime = start.toISOString().slice(11, 16);
    const endTime = end.toISOString().slice(11, 16);
    const dayOfWeek = start.getDay();

    const signature = [
      appointment.doctor_id ?? "",
      specificDate,
      startTime,
      endTime,
      String(duration),
    ].join("|");

    if (seen.has(signature)) continue;
    seen.add(signature);

    rules.push({
      doctor_id: appointment.doctor_id,
      day_of_week: dayOfWeek,
      specific_date: specificDate,
      start_time: startTime,
      end_time: endTime,
      slot_duration: duration,
    });
  }

  return rules;
}

function failExtraction(message: string, status: number, providerError: string) {
  return fail(message, status, {
    error: "DOCUMENT_AI_EXTRACTION_FAILED",
    message:
      "No se pudo extraer informacion real del documento. Revise calidad de imagen, proveedor OCR/IA y credenciales.",
    provider_error: sanitizeProviderError(providerError),
  });
}

function sanitizeProviderError(error: string): string {
  const value = String(error ?? "");
  if (/invalid_api_key|invalid api key|unauthorized|401/i.test(value)) {
    return "DOCUMENT_AI_INVALID_API_KEY";
  }
  if (/api[_ -]?key/i.test(value)) {
    return "DOCUMENT_AI_CREDENTIAL_ERROR";
  }
  return value.slice(0, 300);
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string" || value.trim() === "") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseIntegerEnv(value: string | undefined, defaultValue: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

export function getAgendaImportGroqConfig() {
  const apiKey = String(process.env.GROQ_API_KEY_SECRETARIA ?? "").trim();
  const model = String(process.env.GROQ_MODEL_SECRETARIA ?? "").trim();
  const explicitEnabled = process.env.AGENDA_IMPORT_GROQ_ENABLED;
  const enabledDefault = apiKey.length > 0 && model.length > 0;
  return {
    enabled: parseBooleanEnv(explicitEnabled, enabledDefault) && apiKey.length > 0 && model.length > 0,
    requireSuccess: parseBooleanEnv(process.env.AGENDA_IMPORT_GROQ_REQUIRE_SUCCESS, false),
    apiKey,
    apiKeyEnv: "GROQ_API_KEY_SECRETARIA",
    baseUrl: "https://api.groq.com/openai/v1",
    model,
    modelEnv: "GROQ_MODEL_SECRETARIA",
    timeoutMs: parseIntegerEnv(process.env.AGENDA_IMPORT_GROQ_TIMEOUT_MS, 12_000, 3_000, 60_000),
    maxRetries: parseIntegerEnv(process.env.AGENDA_IMPORT_GROQ_MAX_RETRIES, 0, 0, 2),
  };
}

function getTesseractWorkerPath(): string | undefined {
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js",
  );

  return existsSync(workerPath) ? workerPath : undefined;
}

type MedicalInputDetection = {
  isMedicalImage: boolean;
  confidence: number;
  reason: string;
};

async function detectMedicalImageInputSafe(file: File, mimeType: string): Promise<MedicalInputDetection> {
  try {
    const imagingService = await import("@/medical-imaging/imaging.service");
    return imagingService.detectMedicalImageInput(file, mimeType);
  } catch (error) {
    logServer("warn", "medical_imaging.module_unavailable", {
      endpoint: "/api/import/agenda/parse",
      stage: "detect",
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      isMedicalImage: false,
      confidence: 0,
      reason: "imaging_module_unavailable",
    };
  }
}

async function analyzeMedicalImageSafe(file: File, mimeType: string): Promise<MedicalImagingAnalysis | null> {
  try {
    const imagingService = await import("@/medical-imaging/imaging.service");
    return await imagingService.analyzeMedicalImage(file, mimeType);
  } catch (error) {
    logServer("warn", "medical_imaging.analysis_failed", {
      endpoint: "/api/import/agenda/parse",
      stage: "analyze",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function getAgendaOcrWorker(): Promise<OcrWorker> {
  if (!agendaOcrWorkerPromise) {
    agendaOcrWorkerPromise = (async () => {
      const tesseract = await import("tesseract.js");
      const workerPath = getTesseractWorkerPath();
      const options = workerPath ? { workerPath } : undefined;
      const langs = String(process.env.AGENDA_OCR_LANGS ?? "spa").trim() || "spa";
      const worker = await tesseract.createWorker(langs, 1, options);
      await worker.setParameters({
        preserve_interword_spaces: "1",
      });
      return worker as OcrWorker;
    })().catch((error) => {
      agendaOcrWorkerPromise = null;
      throw error;
    });
  }

  return agendaOcrWorkerPromise;
}

async function prepareImageForAgendaOcr(file: File): Promise<Buffer> {
  const original = Buffer.from(await file.arrayBuffer());
  try {
    return await sharp(original)
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
  } catch (error) {
    logServer("warn", "document_ocr.preprocess_failed", {
      endpoint: "/api/import/agenda/parse",
      error: error instanceof Error ? error.message : String(error),
    });
    return original;
  }
}

async function extractTextFromImage(file: File): Promise<string> {
  const startedAt = Date.now();
  try {
    const worker = await getAgendaOcrWorker();
    const image = await prepareImageForAgendaOcr(file);
    const { data } = await worker.recognize(image);
    const text = (data.text ?? "").trim();

    logServer("info", "document_ocr.completed", {
      endpoint: "/api/import/agenda/parse",
      engine: "tesseract",
      elapsed_ms: Date.now() - startedAt,
      text_length: text.length,
    });

    return text;
  } catch (error) {
    logServer("warn", "document_ocr.fallback_failed", {
      endpoint: "/api/import/agenda/parse",
      engine: "tesseract",
      elapsed_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  const bytes = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const chunks: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    chunks.push(content.items.map((item: unknown) => (typeof item === "object" && item && "str" in item ? String((item as { str?: string }).str ?? "") : "")).join(" "));
  }

  return chunks.join("\n").trim();
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista", "receptionist", "clinic_owner", "clinic_admin"])) {
    return fail("Sin permisos", 403);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return fail("Archivo no valido", 422);
    }

    const mimeType = String(file.type ?? "").toLowerCase();
    const dicomUpload = isDicomUpload(file, mimeType);
    if (!mimeType.startsWith("image/") && mimeType !== "application/pdf" && !dicomUpload) {
      return fail("Formato no soportado. Usa imagen o PDF", 422);
    }

    let rawText = "";
    let visionExtraction: VisionDocumentExtraction | null = null;
    let medicalImagingAnalysis: MedicalImagingAnalysis | null = null;
    let extractedWithAI = false;
    let agendaImportSource: "groq" | "ocr_local" | "pdf_text" | "medical_imaging" = "ocr_local";

    if (mimeType === "application/pdf") {
      rawText = await extractTextFromPdf(file);
      agendaImportSource = "pdf_text";
    } else {
      const detection = await detectMedicalImageInputSafe(file, mimeType);
      if (detection.isMedicalImage || dicomUpload) {
        const imagingResult = await analyzeMedicalImageSafe(file, mimeType);
        if (imagingResult) {
          medicalImagingAnalysis = imagingResult;
          extractedWithAI = true;
          agendaImportSource = "medical_imaging";
          rawText = buildMedicalImagingNarrative(medicalImagingAnalysis, file.name);
          logServer("info", "medical_imaging.structured_analysis", {
            endpoint: "/api/import/agenda/parse",
            mime_type: mimeType || "application/octet-stream",
            detection_confidence: detection.confidence,
            detection_reason: detection.reason,
            study_type: medicalImagingAnalysis.type,
            region: medicalImagingAnalysis.region,
            confidence: medicalImagingAnalysis.confidence,
            model_version: medicalImagingAnalysis.model_version,
            pipeline: medicalImagingAnalysis.pipeline,
          });
        }
      }

      if (!medicalImagingAnalysis) {
        const groqConfig = getAgendaImportGroqConfig();
        if (groqConfig.enabled && isVisionSupportedMimeType(mimeType)) {
          try {
            visionExtraction = await analyzeImageDocumentWithAI(file, {
              provider: "groq",
              baseUrl: groqConfig.baseUrl,
              model: groqConfig.model,
              apiKey: groqConfig.apiKey,
              timeoutMs: groqConfig.timeoutMs,
              maxRetries: groqConfig.maxRetries,
              maxImagePixels: 30_000_000,
              maxImageEdge: 4096,
            });
            rawText = [
              visionExtraction.document_type,
              visionExtraction.doctor_name,
              visionExtraction.specialty,
              visionExtraction.license_number,
              visionExtraction.month,
              visionExtraction.year,
              visionExtraction.raw_summary ?? "",
              ...visionExtraction.schedule.lunes.map((value) => `lunes ${value}`),
              ...visionExtraction.schedule.martes.map((value) => `martes ${value}`),
              ...visionExtraction.schedule.miercoles.map((value) => `miercoles ${value}`),
              ...visionExtraction.schedule.jueves.map((value) => `jueves ${value}`),
              ...visionExtraction.schedule.viernes.map((value) => `viernes ${value}`),
              ...visionExtraction.schedule.sabado.map((value) => `sabado ${value}`),
              ...visionExtraction.schedule.domingo.map((value) => `domingo ${value}`),
            ]
              .map((value) => String(value ?? "").trim())
              .filter(Boolean)
              .join("\n");
            extractedWithAI = true;
            agendaImportSource = "groq";
          } catch (error) {
            logServer("warn", "agenda_import.groq_analysis_failed", {
              endpoint: "/api/import/agenda/parse",
              mime_type: mimeType,
              required: groqConfig.requireSuccess,
              error: sanitizeProviderError(error instanceof Error ? error.message : String(error)),
            });

            if (groqConfig.requireSuccess) {
              return failExtraction(
                "DOCUMENT_AI_EXTRACTION_FAILED",
                422,
                error instanceof Error ? error.message : "Agenda Groq analysis failed",
              );
            }
          }
        }

        if (visionExtraction && needsAgendaHeaderFallback(visionExtraction)) {
          const ocrText = await extractTextFromImage(file);
          if (ocrText) {
            const fallbackExtraction = buildLooseVisionFallbackFromRawText(ocrText);
            visionExtraction = mergeVisionExtractionWithFallback(visionExtraction, fallbackExtraction);
            rawText = [rawText, ocrText].filter(Boolean).join("\n");
            logServer("info", "agenda_import.header_fallback_applied", {
              endpoint: "/api/import/agenda/parse",
              doctor_detected: Boolean(visionExtraction.doctor_name),
              license_detected: Boolean(visionExtraction.license_number),
              specialty_detected: Boolean(visionExtraction.specialty),
              month_detected: Boolean(visionExtraction.month),
              year_detected: Boolean(visionExtraction.year),
            });
          }
        }

        if (!rawText) {
          rawText = await extractTextFromImage(file);
          agendaImportSource = "ocr_local";
        }
        if (rawText) {
          visionExtraction = buildLooseVisionFallbackFromRawText(rawText);
        }
      }
    }

    if (!rawText || rawText.length < 8) {
      logServer("warn", "document_parse.extraction_failed", {
        endpoint: "/api/import/agenda/parse",
        mime_type: mimeType,
        reason: "ocr_empty",
      });

      return failExtraction(
        "DOCUMENT_AI_EXTRACTION_FAILED",
        422,
        "OCR extraction returned empty content",
      );
    }

    const [doctorProfiles, patients, agendaSettings] = await Promise.all([
      prisma.doctorProfile.findMany({
        select: {
          user_id: true,
          matricula: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.patient.findMany({
        select: { id: true, name: true },
      }),
      prisma.agendaSettings.findMany({
        select: {
          user_id: true,
          appointment_duration: true,
        },
      }),
    ]);

    const agendaSettingsByUserId = new Map(
      agendaSettings.map((settings: { user_id: string; appointment_duration: number }) => [settings.user_id, settings]),
    );

    const doctorCandidates = doctorProfiles.map((doctor: { user_id: string; user: { name: string } }) => ({
      id: doctor.user_id,
      text: doctor.user.name,
    }));
    const patientCandidates = patients.map((patient: { id: string; name: string }) => ({
      id: patient.id,
      text: patient.name,
    }));

    const doctorMatch = findDoctorMatch(visionExtraction, rawText, doctorProfiles, agendaSettingsByUserId);
    const matchedDoctorId = doctorMatch.doctorId ?? pickIdByTextMatch(rawText, doctorCandidates);
    const matchedPatientId = pickIdByTextMatch(rawText, patientCandidates);

    const datetimes = parseDateTimeFromText(rawText);
    const appointments: CandidateAppointment[] = datetimes.slice(0, 20).map((dateTime) => ({
      datetime: dateTime.toISOString(),
      duration: 30,
      status: "scheduled",
      source: "manual",
      notes: "Turno detectado por analisis documental",
      doctor_id: matchedDoctorId,
      patient_id: matchedPatientId,
    }));

    let availabilityRules = visionExtraction
      ? buildAvailabilityRulesFromVision(visionExtraction, matchedDoctorId, doctorMatch.slotDuration)
      : [];

    if (availabilityRules.length === 0 && appointments.length > 0) {
      availabilityRules = buildAvailabilityRulesFromAppointments(appointments);
    }

    const rows = availabilityRules.length > 0 ? availabilityRules : appointments.length > 0 ? appointments : [];

    const baseAnalysis = medicalImagingAnalysis ? buildMedicalImageDocumentAnalysis(rawText, medicalImagingAnalysis) : buildDocumentAnalysis(rawText);
    const analysisCandidate = visionExtraction
      ? enrichAnalysisWithVision(baseAnalysis, visionExtraction, rawText)
      : baseAnalysis;
    const analysisValidated = safeValidateDocumentAnalysis(analysisCandidate);
    if (!analysisValidated.success) {
      const issues = analysisValidated.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      }));

      logServer("warn", "document_analysis.validation_failed", {
        endpoint: "/api/import/agenda/parse",
        schema_version: DOCUMENT_ANALYSIS_SCHEMA_VERSION,
        issue_count: issues.length,
        issues,
      });

      return fail("La salida del analisis no cumple el contrato", 500, analysisValidated.error.flatten());
    }

    await prisma.auditLog.create({
      data: {
        user_id: authUser.userId,
        action: "document.analysis.parse",
        entity_type: "document_analysis",
        payload_after: {
          schema_version: DOCUMENT_ANALYSIS_SCHEMA_VERSION,
          file_name: file.name,
          file_mime_type: mimeType,
          file_size_bytes: file.size,
          extracted_with_ai: extractedWithAI,
          detected_appointments: appointments.length,
          detected_availability_rules: availabilityRules.length,
          analysis: analysisValidated.data,
        },
      },
    });

    const structuredHeaderForResponse = extractStructuredMedicalSheetHeader(rawText);
    const detected_doctor_name =
      visionExtraction?.doctor_name?.trim() ||
      structuredHeaderForResponse.doctorName ||
      analysisValidated.data.provider?.professional_name?.trim() ||
      "";
    const detected_doctor_license =
      visionExtraction?.license_number?.trim() ||
      structuredHeaderForResponse.licenseNumber ||
      analysisValidated.data.provider?.license_number?.trim() ||
      "";

    const source: "vision" | "groq" | "metabrain_local" = medicalImagingAnalysis ? "vision" : agendaImportSource === "groq" ? "groq" : "metabrain_local";
    const metabrainDecision = buildAgendaImportGuidance({
      source: agendaImportSource,
      raw_text_length: rawText.length,
      detected_availability_rules: availabilityRules.length,
      detected_appointments: appointments.length,
      detected_doctor_name,
      quality_score: analysisValidated.data.quality_score,
    });

    void publishMetaBrainSignal({
      event: "document.analysis.parse.complete",
      details: {
        source,
        metabrain_action: metabrainDecision.action,
        metabrain_source: metabrainDecision.source,
        metabrain_confidence: metabrainDecision.confidence,
        file_name: file.name,
        mime_type: mimeType,
        detected_appointments: appointments.length,
        detected_availability_rules: availabilityRules.length,
        matched_doctor_id: matchedDoctorId ?? null,
      },
    });

    return ok({
      ok: true,
      source,
      analysis: analysisValidated.data,
      metabrain: {
        action: metabrainDecision.action,
        response: metabrainDecision.response,
        confidence: metabrainDecision.confidence,
        source: metabrainDecision.source,
      },
      imaging_analysis: medicalImagingAnalysis,
      appointments,
      availability_rules: availabilityRules,
      rows,
      matched_doctor_id: matchedDoctorId,
      detected_doctor_name,
      detected_doctor_license,
      detected_specialty: visionExtraction?.specialty?.trim() || structuredHeaderForResponse.specialty || analysisValidated.data.provider?.specialty?.trim() || "",
      detected_month: visionExtraction?.month?.trim() || structuredHeaderForResponse.month || "",
      detected_year: visionExtraction?.year?.trim() || structuredHeaderForResponse.year || "",
    });
  } catch (error) {
    return fail("No se pudo procesar el documento", 500, error instanceof Error ? error.message : null);
  }
}
