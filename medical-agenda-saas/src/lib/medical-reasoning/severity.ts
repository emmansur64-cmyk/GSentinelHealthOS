import type { MedicalReasoningSeverity } from "./types";

const URGENT_PATTERNS = [
  /\b(dolor toracico|dolor torácico|opresion toracica|opresión torácica|disnea|falta de aire|shock|convulsion|convulsión|acv|stroke|hemorragia|suicid|sepsis|anafilaxia)\b/i,
  /\b(signos de alarma|urgente|emergencia|inmediato|riesgo vital)\b/i,
];

const MODERATE_PATTERNS = [
  /\b(fiebre persistente|empeora|descompens|dolor intenso|vomitos persistentes|vómitos persistentes|deterioro|hiperglucemia|hipotension|hipotensión)\b/i,
];

export function detectMedicalReasoningSeverity(text: string): MedicalReasoningSeverity {
  if (URGENT_PATTERNS.some((pattern) => pattern.test(text))) return "urgent";
  if (MODERATE_PATTERNS.some((pattern) => pattern.test(text))) return "moderate";
  return "low";
}

export function buildEmergencyEscalation(severity: MedicalReasoningSeverity): string | null {
  if (severity !== "urgent") return null;
  return "Si hay compromiso vital, red flags mayores o riesgo de dano inmediato, priorizar evaluacion presencial/guardia y estabilizacion antes de ampliar razonamiento.";
}

