import type { MedicalProtocolRiskLevel, MedicalSpecialtyProtocolDefinition } from "./types";

const HIGH_RISK_PATTERNS = [
  /\b(inestable|shock|hipotension|hipotensión|saturacion baja|saturación baja|alteracion de conciencia|alteración de conciencia)\b/i,
  /\b(suicida|plan suicida|anafilaxia|sepsis|hemorragia|acv|stroke|deficit focal|déficit focal|dolor toracico|dolor torácico)\b/i,
];

const CAUTION_PATTERNS = [
  /\b(fiebre persistente|empeora|dolor intenso|disnea|vomitos persistentes|vómitos persistentes|descompens)\b/i,
  /\b(embarazo|lactante|inmunosupres|anciano|comorbilidad|diabetes)\b/i,
];

export function detectProtocolRiskLevel(text: string): MedicalProtocolRiskLevel {
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(text))) return "high";
  if (CAUTION_PATTERNS.some((pattern) => pattern.test(text))) return "caution";
  return "routine";
}

export function buildRiskModifiers(
  protocol: MedicalSpecialtyProtocolDefinition,
  riskLevel: MedicalProtocolRiskLevel,
): string[] {
  if (riskLevel === "high") {
    return [
      `Aplicar umbral bajo para escalamiento en ${protocol.label}.`,
      "Priorizar red flags, estabilidad y necesidad de evaluacion presencial antes de recomendaciones diferidas.",
    ];
  }
  if (riskLevel === "caution") {
    return [
      `Mantener vigilancia aumentada por posible evolucion en ${protocol.label}.`,
      "Explicitar datos faltantes que cambiarian la conducta.",
    ];
  }
  return [`Mantener enfoque protocolizado de ${protocol.label} sin sobreactuar urgencia si no hay red flags.`];
}
