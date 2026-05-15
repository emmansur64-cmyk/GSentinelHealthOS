import type { MedicalProtocolRiskLevel, MedicalSpecialtyProtocolDefinition } from "./types";

export function buildEmergencyModifiers(
  protocol: MedicalSpecialtyProtocolDefinition,
  riskLevel: MedicalProtocolRiskLevel,
): string[] {
  if (protocol.id === "emergency" || riskLevel === "high") {
    return [
      "Si hay compromiso vital, indicar evaluacion urgente/guardia y estabilizacion antes de ampliar diferenciales.",
      "No demorar derivacion por falta de evidencia externa si la seguridad clinica requiere accion.",
    ];
  }

  const protocolRedFlags = protocol.redFlags.slice(0, 4).join(", ");
  return [`Escalar a urgencias si aparecen red flags de ${protocol.label}: ${protocolRedFlags}.`];
}
