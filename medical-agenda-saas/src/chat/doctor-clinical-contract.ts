import type { MetaBrainDecision } from "@/lib/metabrain";

export type DoctorClinicalRoute = "datetime_runtime" | "weather_runtime" | "clinical_pipeline";

export type DoctorClinicalRoutingDecision = {
  route: DoctorClinicalRoute;
  requiresClinicalContract: boolean;
};

export type DoctorClinicalContractInput = {
  message: string;
  response: string;
  requiredSections?: string[];
  forceClinicalContract?: boolean;
};

export type DoctorClinicalContractResult = {
  valid: boolean;
  reasons: string[];
  requiresClinicalContract: boolean;
  sectionHits: number;
  qualityScore: number;
  hasSchedulingLeak: boolean;
};

type DoctorClinicalFallbackReason =
  | "groq_unavailable"
  | "groq_contract_rejected"
  | "brain_unavailable"
  | "brain_contract_rejected"
  | "providers_unavailable"
  | "providers_rejected";

export type DoctorClinicalFallbackInput = {
  message: string;
  clinicalState?: string | null;
  patientName?: string | null;
  doctorSpecialty?: string | null;
  protocolLabel?: string | null;
  protocolRedFlags?: string[];
  requiredSections?: string[];
  hasExternalEvidence: boolean;
  requiresClinicalContract: boolean;
  reason: DoctorClinicalFallbackReason;
};

const DEFAULT_CLINICAL_SECTIONS = [
  "Resumen clinico",
  "Hipotesis",
  "Factores de riesgo",
  "Red flags",
  "Evidencia utilizada",
  "Sugerencias de evaluacion",
  "Limitaciones",
  "Disclaimer clinico",
];

const CLINICAL_INTENT_PATTERNS: RegExp[] = [
  /\b(paciente|diagnost|tratamiento|dosis|farmaco|medicamento|interaccion)\b/i,
  /\b(dolor|fiebre|disnea|convulsion|cefalea|neurolog|psiquiatr|sepsis|shock)\b/i,
  /\b(red flags|signos de alarma|conducta|diferencial|hipotesis|evaluacion)\b/i,
  /\b(anti\s*-?\s*nmda|encefalitis|sertralina|sumatriptan|serotoninerg)\b/i,
  /\b\d+\s?(mg|mcg|g|ml)\b/i,
];

const DATETIME_PATTERNS: RegExp[] = [
  /\b(que|cual)\s+(fecha|hora)\s+es\b/i,
  /\b(que fecha es hoy|que dia es hoy|en que dia estamos|fecha de hoy)\b/i,
  /\b(hora actual|fecha actual|fecha y hora)\b/i,
];

const WEATHER_PATTERNS: RegExp[] = [
  /\b(clima|tiempo|temperatura|lluvia|viento|humedad)\b/i,
];

const SCHEDULING_LEAK_PATTERNS: RegExp[] = [
  /\b(turno|turnos|cita|citas|agenda|agendar|reservar|reserva|reprogramar|reprograma|disponibilidad horaria)\b/i,
  /\b(book|booking|appointment|schedule|calendar|slot)\b/i,
];

const LIMITATION_PATTERNS: RegExp[] = [
  /\blimitacion|incertidumbre|datos faltantes|faltan datos\b/i,
  /\bno hay datos suficientes|no se dispone de\b/i,
];

const DISCLAIMER_PATTERNS: RegExp[] = [
  /\bno reemplaza criterio medico|no reemplaza el juicio clinico|no sustituye evaluacion presencial\b/i,
  /\besta orientacion no reemplaza|no constituye diagnostico definitivo\b/i,
];

const STANDARD_CLINICAL_DISCLAIMER =
  "Esta orientacion no reemplaza criterio medico ni evaluacion presencial. No constituye diagnostico definitivo y debe ajustarse a protocolos institucionales.";

function normalize(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDateTimeQuery(normalizedMessage: string): boolean {
  const hasHora = /\bhora\b/.test(normalizedMessage);
  const hasFecha = /\bfecha\b/.test(normalizedMessage) || /\bdia\b/.test(normalizedMessage);
  const matchesPattern = DATETIME_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
  return matchesPattern || (normalizedMessage.length <= 40 && (hasHora || hasFecha)) || (hasHora && hasFecha);
}

function isWeatherQuery(normalizedMessage: string): boolean {
  return WEATHER_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
}

export function requiresDoctorClinicalContract(message: string): boolean {
  const normalized = normalize(message);
  if (!normalized) return false;
  if (isDateTimeQuery(normalized) || isWeatherQuery(normalized)) return false;
  return CLINICAL_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function resolveDoctorClinicalRoute(message: string): DoctorClinicalRoutingDecision {
  const normalized = normalize(message);
  if (isDateTimeQuery(normalized)) {
    return {
      route: "datetime_runtime",
      requiresClinicalContract: false,
    };
  }

  if (isWeatherQuery(normalized)) {
    return {
      route: "weather_runtime",
      requiresClinicalContract: false,
    };
  }

  return {
    route: "clinical_pipeline",
    requiresClinicalContract: requiresDoctorClinicalContract(normalized),
  };
}

function countSectionHits(response: string, requiredSections: string[]): number {
  const normalizedResponse = normalize(response);
  return requiredSections.reduce((hits, section) => {
    const sectionToken = normalize(section);
    return normalizedResponse.includes(sectionToken) ? hits + 1 : hits;
  }, 0);
}

function hasSchedulingLeak(response: string): boolean {
  const normalizedResponse = normalize(response);
  return SCHEDULING_LEAK_PATTERNS.some((pattern) => pattern.test(normalizedResponse));
}

export function evaluateDoctorClinicalContract(input: DoctorClinicalContractInput): DoctorClinicalContractResult {
  const requiresClinical = input.forceClinicalContract ?? requiresDoctorClinicalContract(input.message);
  const requiredSections = input.requiredSections?.length
    ? input.requiredSections
    : DEFAULT_CLINICAL_SECTIONS;

  const reasons: string[] = [];
  const normalizedResponse = normalize(input.response);
  const sectionHits = countSectionHits(normalizedResponse, requiredSections);
  const schedulingLeak = hasSchedulingLeak(normalizedResponse);

  if (!normalizedResponse) {
    reasons.push("response_empty");
  }

  if (schedulingLeak) {
    reasons.push("agenda_leak_detected");
  }

  if (requiresClinical) {
    const minSectionHits = Math.max(3, Math.min(5, Math.floor(requiredSections.length * 0.5)));
    if (sectionHits < minSectionHits) {
      reasons.push("structured_sections_missing");
    }
    if (!LIMITATION_PATTERNS.some((pattern) => pattern.test(normalizedResponse))) {
      reasons.push("limitations_missing");
    }
    if (!DISCLAIMER_PATTERNS.some((pattern) => pattern.test(normalizedResponse))) {
      reasons.push("clinical_disclaimer_missing");
    }
    if (normalizedResponse.length < 220) {
      reasons.push("response_too_short_for_clinical_case");
    }
  }

  const qualityScore = Math.max(0, 1 - reasons.length * 0.2);

  return {
    valid: reasons.length === 0,
    reasons,
    requiresClinicalContract: requiresClinical,
    sectionHits,
    qualityScore,
    hasSchedulingLeak: schedulingLeak,
  };
}

export function ensureDoctorClinicalDisclaimer(response: string, requiresClinicalContract: boolean): string {
  const raw = String(response ?? "").trim();
  if (!requiresClinicalContract || !raw) return raw;
  const normalized = normalize(raw);
  const hasDisclaimer = DISCLAIMER_PATTERNS.some((pattern) => pattern.test(normalized));
  if (hasDisclaimer) return raw;

  return `${raw}\n\nDisclaimer clinico:\n${STANDARD_CLINICAL_DISCLAIMER}`;
}

function sanitizeClinicalSummaryMessage(message: string): string {
  const raw = String(message ?? "").trim();
  if (!raw) return "sin contenido";

  const sanitized = raw
    .replace(/\b(turno|turnos|agenda|agendar|cita|citas|reservar|reserva|disponibilidad)\b/gi, "operativo")
    .replace(/\s+/g, " ")
    .trim();

  if (sanitized.length <= 320) return sanitized;
  return `${sanitized.slice(0, 317).trim()}...`;
}

function buildFallbackReasonLabel(reason: DoctorClinicalFallbackReason): string {
  switch (reason) {
    case "groq_unavailable":
      return "Proveedor principal no disponible";
    case "groq_contract_rejected":
      return "Respuesta del proveedor principal rechazada por contrato clinico";
    case "brain_unavailable":
      return "Orquestador clinico no disponible";
    case "brain_contract_rejected":
      return "Respuesta del orquestador rechazada por contrato clinico";
    case "providers_rejected":
      return "Respuestas de proveedores rechazadas por validacion clinica";
    case "providers_unavailable":
    default:
      return "Servicios clinicos externos no disponibles";
  }
}

function buildClinicalSectionMap(input: DoctorClinicalFallbackInput): Record<string, string> {
  const protocolLabel = input.protocolLabel?.trim() || "medicina general";
  const doctorSpecialty = input.doctorSpecialty?.trim() || "medicina general";
  const redFlags = (input.protocolRedFlags ?? []).slice(0, 5);
  const reasonLabel = buildFallbackReasonLabel(input.reason);
  const patientLabel = input.patientName?.trim() || "sin paciente seleccionado";
  const summarizedMessage = sanitizeClinicalSummaryMessage(input.message);

  return {
    "Resumen clinico": [
      `Consulta recibida: ${summarizedMessage}.`,
      `Paciente: ${patientLabel}.`,
      `Especialidad de referencia del medico: ${doctorSpecialty}.`,
      input.clinicalState?.trim() ? `Estado clinico aportado: ${input.clinicalState.trim()}.` : "Sin estado clinico adicional aportado.",
      `Contexto de protocolo: ${protocolLabel}.`,
    ].join(" "),
    Hipotesis:
      "Priorizar diagnostico diferencial sindromico y reevaluacion seriada. Mantener enfoque de riesgo antes de confirmar etiologia definitiva.",
    "Factores de riesgo":
      "Integrar comorbilidades, medicacion actual, tiempo de evolucion, signos vitales y posibles interacciones farmacologicas antes de definir conducta.",
    "Red flags":
      redFlags.length > 0
        ? redFlags.join("; ")
        : "Deterioro neurologico, compromiso respiratorio, inestabilidad hemodinamica, alteracion de conciencia o dolor intenso progresivo.",
    "Evidencia utilizada": input.hasExternalEvidence
      ? "Hay evidencia externa controlada disponible en contexto; usarla sin extrapolar fuera de las fuentes provistas."
      : "No se uso evidencia externa en este fallback. La orientacion se basa en contexto local y razonamiento clinico general.",
    "Sugerencias de evaluacion": [
      "1) Revalorar estado general, ABC y signos vitales en forma inmediata.",
      "2) Solicitar estudios dirigidos al riesgo dominante y diferenciales de mayor impacto.",
      "3) Definir criterios explicitos de escalamiento, interconsulta y derivacion presencial.",
    ].join(" "),
    Limitaciones: [
      `Fallback seguro activado: ${reasonLabel}.`,
      "La respuesta puede omitir matices del caso si faltan datos clinicos, examen fisico o resultados complementarios.",
    ].join(" "),
    "Disclaimer clinico":
      STANDARD_CLINICAL_DISCLAIMER,
  };
}

export function buildDoctorClinicalFallbackDecision(input: DoctorClinicalFallbackInput): MetaBrainDecision {
  if (!input.requiresClinicalContract) {
    return {
      action: "DOCTOR_CHAT_SAFE_GENERAL_FALLBACK",
      response:
        "No puedo completar una respuesta confiable en este momento por indisponibilidad de servicios de soporte. Reintentar en unos segundos.",
      confidence: 0.3,
      source: "RULES",
    };
  }

  const sectionMap = buildClinicalSectionMap(input);
  const sections = input.requiredSections?.length ? input.requiredSections : DEFAULT_CLINICAL_SECTIONS;
  const response = sections
    .map((section) => `${section}:\n${sectionMap[section] ?? "Sin datos adicionales en este bloque."}`)
    .join("\n\n");

  return {
    action: "DOCTOR_CHAT_CLINICAL_FALLBACK_STRUCTURED",
    response,
    confidence: 0.45,
    source: "RULES",
  };
}

function isAllowedMetadataKey(key: string): boolean {
  return [
    "chat_request_id",
    "chat_session_id",
    "request_id",
    "trace_id",
    "correlation_id",
    "doctor_context",
    "locale",
    "timezone",
  ].includes(key);
}

export function buildDoctorClinicalIsolatedMetadata(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const output: Record<string, unknown> = {
    routing_domain: "doctor_clinical",
    routing_policy: "deterministic_doctor_clinical_v1",
    legacy_agenda_fallback_allowed: false,
  };

  if (!input || typeof input !== "object") {
    return output;
  }

  for (const [key, value] of Object.entries(input)) {
    if (!isAllowedMetadataKey(key)) continue;
    output[key] = value;
  }

  return output;
}
