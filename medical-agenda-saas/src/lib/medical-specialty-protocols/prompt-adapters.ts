import type { MedicalSpecialtyProtocolDefinition } from "./types";

export function buildSpecialtyPromptInstruction(protocol: MedicalSpecialtyProtocolDefinition): string {
  return [
    `Adaptar la respuesta al marco de ${protocol.label}.`,
    `Tono: ${protocol.tone}.`,
    `Razonamiento: ${protocol.reasoningStyle}.`,
    "Usar este protocolo como guia auxiliar; no reemplaza criterio medico ni protocolos institucionales locales.",
  ].join(" ");
}

export function buildEvidencePolicy(protocol: MedicalSpecialtyProtocolDefinition, hasRetrievalEvidence: boolean): string {
  if (hasRetrievalEvidence) {
    return `${protocol.evidenceUse}. Si hay evidencia externa controlada, citarla solo desde el bloque de retrieval provisto.`;
  }
  return `${protocol.evidenceUse}. No afirmar que se consultaron fuentes externas; declarar incertidumbre si falta evidencia.`;
}
