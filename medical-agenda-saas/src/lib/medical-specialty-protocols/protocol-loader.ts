import { SPECIALTY_PROTOCOL_REGISTRY } from "./registry";
import type { MedicalSpecialtyId, MedicalSpecialtyProtocolDefinition } from "./types";

const FALLBACK_SPECIALTY: MedicalSpecialtyId = "general_medicine";

export function loadSpecialtyProtocol(specialty: MedicalSpecialtyId): MedicalSpecialtyProtocolDefinition {
  return (
    SPECIALTY_PROTOCOL_REGISTRY.find((protocol) => protocol.id === specialty) ??
    SPECIALTY_PROTOCOL_REGISTRY.find((protocol) => protocol.id === FALLBACK_SPECIALTY) ??
    SPECIALTY_PROTOCOL_REGISTRY[0]
  );
}

export function detectSpecialtyProtocol(text: string): MedicalSpecialtyProtocolDefinition {
  const emergency = SPECIALTY_PROTOCOL_REGISTRY.find((protocol) => protocol.id === "emergency");
  if (emergency?.patterns.some((pattern) => pattern.test(text))) return emergency;

  return (
    SPECIALTY_PROTOCOL_REGISTRY.find((protocol) => protocol.patterns.some((pattern) => pattern.test(text))) ??
    loadSpecialtyProtocol(FALLBACK_SPECIALTY)
  );
}
