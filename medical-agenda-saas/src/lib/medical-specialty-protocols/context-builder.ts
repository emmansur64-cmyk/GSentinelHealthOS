import { buildEmergencyModifiers } from "./emergency-modifiers";
import { buildProtocolFallback } from "./fallback";
import { detectSpecialtyProtocol } from "./protocol-loader";
import { buildEvidencePolicy, buildSpecialtyPromptInstruction } from "./prompt-adapters";
import { buildRiskModifiers, detectProtocolRiskLevel } from "./risk-modifiers";
import type { MedicalSpecialtyProtocolContext, MedicalSpecialtyProtocolInput } from "./types";

function shouldApplySpecialtyProtocol(text: string): boolean {
  return /\b(paciente|diagnostico|diagnóstico|tratamiento|conducta|protocolo|red flags|riesgo|dolor|fiebre|medicamento|dosis|evaluacion|evaluación|urgencia|emergencia|cardio|psiquiatr|pediatr|neuro|endo|psicolog)\b/i.test(
    text,
  );
}

export function buildMedicalSpecialtyProtocolContext(
  input: MedicalSpecialtyProtocolInput,
): MedicalSpecialtyProtocolContext | null {
  try {
    const text = `${input.message} ${input.clinicalState ?? ""}`.trim();
    if (!shouldApplySpecialtyProtocol(text)) return null;

    const protocol = detectSpecialtyProtocol(text);
    const riskLevel = detectProtocolRiskLevel(text);

    return {
      instruction: buildSpecialtyPromptInstruction(protocol),
      specialty: riskLevel === "high" ? "emergency" : protocol.id,
      label: riskLevel === "high" ? "Urgencias" : protocol.label,
      riskLevel,
      tone: protocol.tone,
      reasoningStyle: protocol.reasoningStyle,
      protocolFocus: protocol.protocolFocus,
      redFlags: protocol.redFlags,
      evidencePolicy: buildEvidencePolicy(protocol, input.hasRetrievalEvidence),
      structureHints: protocol.structureHints,
      riskModifiers: buildRiskModifiers(protocol, riskLevel),
      emergencyModifiers: buildEmergencyModifiers(protocol, riskLevel),
      compatibility: {
        retrieval: input.hasRetrievalEvidence ? "available" : "not_available",
        runtimeContext: input.hasRuntimeContext ? "available" : "not_available",
      },
      fallback: false,
      errors: [],
    };
  } catch (error) {
    return buildProtocolFallback(error);
  }
}
