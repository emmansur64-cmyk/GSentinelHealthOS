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

const CLINICAL_PATTERNS: Array<{ reason: string; pattern: RegExp }> = [
  { reason: "clinical_assessment", pattern: /\b(paciente|caso|cuadro|clinico|clínico|sintoma|síntoma|signo|diagnostico|diagnóstico|diferencial|conducta|manejo|tratamiento|seguimiento|estudio|laboratorio|imagen|rx|tc|rmn|ecg)\b/i },
  { reason: "clinical_condition", pattern: /\b(fiebre|dolor|disnea|tos|shock|sepsis|infeccion|infección|hipertension|hipertensión|diabetes|asma|epoc|neumonia|neumonía|ictus|acv|infarto|embarazo|trauma)\b/i },
  { reason: "clinical_specialty", pattern: /\b(cardiologia|cardiología|pediatria|pediatría|clinica medica|clínica médica|uti|terapia intensiva|neurologia|neurología|psiquiatria|psiquiatría|ginecologia|ginecología|traumatologia|traumatología)\b/i },
];

export function evaluateMedicalWebRetrievalPolicy(message: string): { shouldRetrieve: boolean; reasons: string[] } {
  const normalized = String(message ?? "").trim();
  if (!normalized) return { shouldRetrieve: false, reasons: [] };

  const onlyNonClinical =
    normalized.length < 80 &&
    NON_ACTIVATION_PATTERNS.some((pattern) => pattern.test(normalized)) &&
    !/\b(medicamento|evidencia|protocolo|guia|guía|paper|farmaco|fármaco|psiquiatria|psiquiatría|diagnostico|diagnóstico|tratamiento|paciente)\b/i.test(normalized);

  if (onlyNonClinical) {
    return { shouldRetrieve: false, reasons: [] };
  }

  const explicitReasons = ACTIVATION_PATTERNS
    .filter((item) => item.pattern.test(normalized))
    .map((item) => item.reason);
  const clinicalReasons = CLINICAL_PATTERNS
    .filter((item) => item.pattern.test(normalized))
    .map((item) => item.reason);
  const reasons = Array.from(new Set([...explicitReasons, ...clinicalReasons]));

  return { shouldRetrieve: reasons.length > 0, reasons };
}
