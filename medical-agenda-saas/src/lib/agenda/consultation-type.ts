export const CONSULTATION_TYPE_DURATION = {
  primera_vez: 45,
  control: 20,
  urgencia: 15,
} as const;

export type ConsultationType = keyof typeof CONSULTATION_TYPE_DURATION;

export function normalizeConsultationType(value?: string | null): ConsultationType | null {
  if (!value) return null;

  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (normalized === "primera vez" || normalized === "primera_vez") return "primera_vez";
  if (normalized === "control") return "control";
  if (normalized === "urgencia") return "urgencia";

  return null;
}

export function getConsultationDuration(type: ConsultationType): number {
  return CONSULTATION_TYPE_DURATION[type];
}

export function inferConsultationTypeFromAppointment(input: {
  notes?: string | null;
  duration: number;
}): ConsultationType {
  const notes = String(input.notes ?? "").toLowerCase();

  if (notes.includes("tipo_consulta:primera_vez") || notes.includes("tipo_consulta=primera_vez")) {
    return "primera_vez";
  }
  if (notes.includes("tipo_consulta:urgencia") || notes.includes("tipo_consulta=urgencia")) {
    return "urgencia";
  }
  if (notes.includes("tipo_consulta:control") || notes.includes("tipo_consulta=control")) {
    return "control";
  }

  if (input.duration >= 45) return "primera_vez";
  if (input.duration <= 15) return "urgencia";
  return "control";
}
