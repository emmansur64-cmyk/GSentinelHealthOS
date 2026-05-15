import { loadSpecialtyProtocol } from "./protocol-loader";
import type { MedicalSpecialtyProtocolContext } from "./types";

export function buildProtocolFallback(error: unknown): MedicalSpecialtyProtocolContext {
  const protocol = loadSpecialtyProtocol("general_medicine");
  return {
    instruction:
      "Usar protocolo clinico general como fallback seguro. No afirmar diagnosticos absolutos, no inventar evidencia y priorizar red flags.",
    specialty: protocol.id,
    label: protocol.label,
    riskLevel: "routine",
    tone: protocol.tone,
    reasoningStyle: protocol.reasoningStyle,
    protocolFocus: protocol.protocolFocus,
    redFlags: protocol.redFlags,
    evidencePolicy: "No inventar evidencia ni fuentes externas.",
    structureHints: protocol.structureHints,
    riskModifiers: ["Fallback activo: mantener conducta conservadora y explicitar limitaciones."],
    emergencyModifiers: ["Escalar a urgencias si aparecen red flags o inestabilidad."],
    compatibility: {
      retrieval: "not_available",
      runtimeContext: "not_available",
    },
    fallback: true,
    errors: [error instanceof Error ? error.message.slice(0, 120) : "specialty_protocol_failed"],
  };
}
