const ACTIVATION_PATTERNS: Array<{ reason: string; pattern: RegExp }> = [
  { reason: "medication", pattern: /\b(medicamento|farmaco|fármaco|droga|dosis|posologia|posología|interaccion|interacción|contraindicacion|contraindicación|efecto adverso|dailymed)\b/i },
  { reason: "guideline_protocol", pattern: /\b(guia|guía|guideline|protocolo|consenso|algoritmo|recomendacion actual|recomendación actual)\b/i },
  { reason: "evidence_papers", pattern: /\b(evidencia|paper|papers|estudio|ensayo|meta.?analisis|metaanalisis|cochrane|pubmed|nejm|lancet|jama|bmj)\b/i },
  { reason: "procedure", pattern: /\b(procedimiento|tecnica|técnica|manejo actualizado|tratamiento actualizado|ultima guia|última guía|actualizado)\b/i },
  { reason: "mental_health", pattern: /\b(psiquiatria|psiquiatría|psicologia|psicología|salud mental|depresion|depresión|ansiedad|suicidio|trastorno bipolar|psicosis)\b/i },
  { reason: "explicit_search", pattern: /\b(buscar evidencia|consultar evidencia|consultar protocolo|buscar protocolo|buscar guia|buscar guía|revisar literatura|qué dice la literatura|que dice la literatura)\b/i },
];

const NON_ACTIVATION_PATTERNS = [
  /\b(hola|buenas|buen dia|buen día|como estas|cómo estás|gracias|ok|dale)\b/i,
  /\b(turno|cita|agenda|reprogramar|cancelar|reservar|horario|paciente no vino|disponibilidad)\b/i,
];

export function evaluateMedicalWebRetrievalPolicy(message: string): { shouldRetrieve: boolean; reasons: string[] } {
  const normalized = String(message ?? "").trim();
  if (!normalized) return { shouldRetrieve: false, reasons: [] };

  const reasons = ACTIVATION_PATTERNS.filter((item) => item.pattern.test(normalized)).map((item) => item.reason);
  if (reasons.length === 0) return { shouldRetrieve: false, reasons: [] };

  const onlyNonClinical =
    normalized.length < 80 &&
    NON_ACTIVATION_PATTERNS.some((pattern) => pattern.test(normalized)) &&
    !/\b(medicamento|evidencia|protocolo|guia|guía|paper|farmaco|fármaco|psiquiatria|psiquiatría)\b/i.test(normalized);

  return { shouldRetrieve: !onlyNonClinical, reasons };
}
