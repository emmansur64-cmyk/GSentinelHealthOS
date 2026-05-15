const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\s().-]?){8,18}/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const DNI_RE = /\b(?:dni|documento|cedula|cédula)\s*:?\s*\d{6,12}\b/gi;
const INTERNAL_ID_RE = /\b(?:patient_id|doctor_id|tenant_id|appointment_id|conversation_id)\s*[:=]\s*[\w:-]+\b/gi;
const PATIENT_NAME_RE = /\b(?:paciente|patient)\s*:?\s+[A-ZÁÉÍÓÚÑ][\p{L}'-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}'-]+){0,3}/giu;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function redactPhiFromMedicalQuery(value: string): string {
  return normalizeWhitespace(
    String(value ?? "")
      .replace(EMAIL_RE, " ")
      .replace(PHONE_RE, " ")
      .replace(UUID_RE, " ")
      .replace(DNI_RE, " ")
      .replace(INTERNAL_ID_RE, " ")
      .replace(PATIENT_NAME_RE, "paciente")
      .replace(/[^\p{L}\p{N}\s.,;:()/%+-]/gu, " "),
  ).slice(0, 240);
}

export function buildMedicalWebQuery(input: { message: string; clinicalState?: string | null }): string {
  const message = redactPhiFromMedicalQuery(input.message);
  const combined = normalizeWhitespace(message);
  if (!combined) return "";
  return `${combined} evidencia clinica guia medicamento revision`;
}
