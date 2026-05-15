import { buildEmergencyEscalation, detectMedicalReasoningSeverity } from "./severity";
import { detectMedicalReasoningSpecialty } from "./specialty-adapters";
import {
  STRUCTURED_MEDICAL_REASONING_INSTRUCTION,
  STRUCTURED_MEDICAL_REASONING_SECTIONS,
} from "./templates";
import type { MedicalReasoningContext, MedicalReasoningInput } from "./types";

function isClinicalQuestion(text: string, hasPatientContext: boolean): boolean {
  if (hasPatientContext) return true;
  return /\b(paciente|diagnostico|diagnóstico|tratamiento|conducta|medicamento|dosis|dolor|fiebre|hipotesis|hipótesis|evaluacion|evaluación|red flags|signos de alarma|riesgo)\b/i.test(text);
}

export function buildMedicalReasoningContext(input: MedicalReasoningInput): MedicalReasoningContext | null {
  try {
    const text = `${input.message} ${input.clinicalState ?? ""}`.trim();
    if (!isClinicalQuestion(text, input.hasPatientContext)) return null;

    const specialty = detectMedicalReasoningSpecialty(text);
    const severity = detectMedicalReasoningSeverity(text);

    return {
      instruction: STRUCTURED_MEDICAL_REASONING_INSTRUCTION,
      specialty: severity === "urgent" ? "emergency" : specialty.specialty,
      severity,
      requiredSections: STRUCTURED_MEDICAL_REASONING_SECTIONS,
      specialtyGuidance: specialty.guidance,
      emergencyEscalation: buildEmergencyEscalation(severity),
      evidencePolicy: input.hasRetrievalEvidence
        ? "Usar evidencia externa controlada solo si esta en el bloque EVIDENCIA MEDICA EXTERNA CONTROLADA."
        : "No afirmar que se consulto evidencia externa. Indicar que la respuesta se basa en contexto provisto y conocimiento general.",
      fallback: false,
      errors: [],
    };
  } catch (error) {
    return {
      instruction: STRUCTURED_MEDICAL_REASONING_INSTRUCTION,
      specialty: "general",
      severity: "low",
      requiredSections: STRUCTURED_MEDICAL_REASONING_SECTIONS,
      specialtyGuidance: ["Usar estructura clinica general y explicitar limitaciones."],
      emergencyEscalation: null,
      evidencePolicy: "No inventar evidencia.",
      fallback: true,
      errors: [error instanceof Error ? error.message.slice(0, 120) : "reasoning_failed"],
    };
  }
}

