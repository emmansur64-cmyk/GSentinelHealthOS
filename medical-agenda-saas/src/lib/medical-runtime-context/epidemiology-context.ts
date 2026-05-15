import type { MedicalRuntimeEpidemiologyContext } from "./types";

export function buildEpidemiologyContext(): MedicalRuntimeEpidemiologyContext {
  return {
    source: "placeholder_v1_no_external_epidemiology_fetch",
    respiratoryOutbreaks: [],
    dengueVectorAlerts: [],
    influenzaAlerts: [],
    notes: [
      "V1 no consulta brotes en tiempo real; reservado para fuentes oficiales futuras como WHO, OPS, Ministerio de Salud o SMN.",
    ],
  };
}

