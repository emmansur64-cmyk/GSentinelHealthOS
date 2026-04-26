import { createRequire } from "module";

import { ok, fail } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { DOCUMENT_ANALYSIS_SCHEMA_VERSION, safeValidateDocumentAnalysis } from "@/lib/document-analysis-schema";
import { buildLooseVisionFallbackFromRawText, type VisionDocumentExtraction } from "@/lib/document-ai";
import { publishMetaBrainSignal } from "@/lib/metabrain-bridge";
import { logServer } from "@/lib/server-logger";
import {
  analyzeMedicalImage,
  detectMedicalImageInput,
  type MedicalImagingAnalysis,
} from "@/medical-imaging/imaging.service";

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

function buildRawTextFromVisionExtraction(extraction: VisionDocumentExtraction): string {
  const scheduleLines = [
    ...extraction.schedule.lunes.map((value) => `lunes ${value}`),
    ...extraction.schedule.martes.map((value) => `martes ${value}`),
    ...extraction.schedule.miercoles.map((value) => `miercoles ${value}`),
    ...extraction.schedule.jueves.map((value) => `jueves ${value}`),
    ...extraction.schedule.viernes.map((value) => `viernes ${value}`),
    ...extraction.schedule.sabado.map((value) => `sabado ${value}`),
    ...extraction.schedule.domingo.map((value) => `domingo ${value}`),
  ];

  return [
    extraction.document_type,
    extraction.language,
    extraction.doctor_name,
    extraction.specialty,
    extraction.license_number,
    extraction.month,
    extraction.year,
    extraction.raw_summary ?? "",
    ...scheduleLines,
  ]
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0)
    .join("\n");
}

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

function findDoctorMatch(
  extraction: VisionDocumentExtraction | null,
  rawText: string,
  doctors: Array<{ user_id: string; matricula: string; user: { name: string } }>,
  agendaSettingsByUserId: Map<string, { appointment_duration: number }>,
): { doctorId?: string; slotDuration: number } {
  const normalizedDoctorName = normalizeLooseText(extraction?.doctor_name ?? "");
  const normalizedLicense = normalizeLooseText(extraction?.license_number ?? "");
  const normalizedRawText = normalizeLooseText(rawText);

  const matched = doctors.find((doctor) => {
    const normalizedName = normalizeLooseText(doctor.user.name);
    const normalizedMatricula = normalizeLooseText(doctor.matricula);

    return (
      (normalizedLicense && normalizedMatricula === normalizedLicense) ||
      (normalizedDoctorName && (normalizedName.includes(normalizedDoctorName) || normalizedDoctorName.includes(normalizedName))) ||
      normalizedRawText.includes(normalizedName) ||
      (normalizedMatricula.length > 0 && normalizedRawText.includes(normalizedMatricula))
    );
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
    provider_error: providerError,
  });
}

async function extractTextFromImage(file: File): Promise<string> {
  try {
    const tesseract = await import("tesseract.js");
    const require = createRequire(import.meta.url);
    const workerPath = require.resolve("tesseract.js/src/worker-script/node/index.js");

    const { data } = await tesseract.recognize(Buffer.from(await file.arrayBuffer()), "spa+eng", {
      workerPath,
    });

    return (data.text ?? "").trim();
  } catch (error) {
    logServer("warn", "document_ocr.fallback_failed", {
      endpoint: "/api/import/agenda/parse",
      engine: "tesseract",
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

    if (mimeType === "application/pdf") {
      rawText = await extractTextFromPdf(file);
    } else {
      const detection = detectMedicalImageInput(file, mimeType);
      if (detection.isMedicalImage || dicomUpload) {
        medicalImagingAnalysis = await analyzeMedicalImage(file, mimeType);
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
      } else {
        // MetaBrain: extrae texto via OCR local y construye estructura de horarios
        rawText = await extractTextFromImage(file);
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

    const detected_doctor_name = visionExtraction?.doctor_name?.trim() || analysisValidated.data.provider?.professional_name?.trim() || "";
    const detected_doctor_license = visionExtraction?.license_number?.trim() || analysisValidated.data.provider?.license_number?.trim() || "";

    const source: "vision" | "ocr" = medicalImagingAnalysis ? "vision" : "ocr";

    void publishMetaBrainSignal({
      event: "document.analysis.parse.complete",
      details: {
        source,
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
      imaging_analysis: medicalImagingAnalysis,
      appointments,
      availability_rules: availabilityRules,
      rows,
      matched_doctor_id: matchedDoctorId,
      detected_doctor_name,
      detected_doctor_license,
    });
  } catch (error) {
    return fail("No se pudo procesar el documento", 500, error instanceof Error ? error.message : null);
  }
}
