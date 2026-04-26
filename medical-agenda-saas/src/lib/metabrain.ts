export type MetaBrainSource = "ML" | "RULES" | "DL" | "GROQ";

export type MetaBrainDecisionInput = {
  role: "DOCTOR";
  message: string;
  context: {
    doctor_id: string;
    patient: {
      id: string;
      name: string;
      phone: string;
      notes?: string | null;
    } | null;
    current_appointment: {
      id: string;
      datetime: string;
      status: string;
      notes?: string | null;
    } | null;
    recent_history: Array<{
      id: string;
      datetime: string;
      status: string;
      notes?: string | null;
      doctor_name?: string | null;
    }>;
    conversation_history: Array<{
      doctor_message: string;
      response: string;
      confidence: number;
      source: MetaBrainSource;
      action?: string;
      created_at: string;
    }>;
    clinical_state?: string | null;
    metadata?: Record<string, unknown>;
  };
};

export type MetaBrainDecision = {
  action: string;
  response: string;
  confidence: number;
  source: MetaBrainSource;
};

export type ImagingMetaBrainInput = {
  study_type: string;
  region: string;
  findings: string[];
  confidence: number;
};

const URGENT_TERMS = [
  "dolor toracico",
  "disnea",
  "falta de aire",
  "convulsion",
  "convulsiones",
  "hemorragia",
  "perdida de conocimiento",
  "confusion aguda",
  "shock",
  "stroke",
  "acv",
  "signos de alarma",
  "urgente",
];

const SUMMARY_TERMS = ["resumen", "resume", "sintesis", "antecedentes", "contexto"];
const FOLLOWUP_TERMS = ["seguimiento", "control", "conducta", "plan", "proximo paso", "reevaluacion", "revaluacion"];
const DOCUMENTATION_TERMS = ["evolucion", "nota", "registro", "documenta", "soap", "epicrisis"];
const CHEST_PAIN_TERMS = ["dolor en el pecho", "dolor toracico", "dolor de pecho", "opresion toracica", "precordialgia"];
const DIFFERENTIAL_TERMS = ["causa", "causas", "comunes", "diferencial", "diagnostico diferencial"];
const CONTINUATION_TERMS = ["que mas", "que mas se puede hacer", "algo mas", "siguiente paso", "y ahora", "ademas", "mas detalle"];
const TBI_TERMS = ["tce", "traumatismo craneoencefalico", "trauma craneal", "glasgow", "inconsciente", "impacto craneal", "neurocirugia"];
const GREETING_TERMS = ["hola", "buenas", "buen dia", "que tal", "como va", "hey"];
const WELLBEING_TERMS = ["como estas", "como te va", "como andas", "todo bien", "que tal estas"];
const DATE_QUERY_TERMS = ["sabes que dia es hoy", "que dia es hoy", "que fecha es hoy", "en que dia estamos", "que dia estamos", "fecha de hoy"];

const CONTINUATION_VARIANTS = [
  [
    "Para avanzar sobre lo ya conversado, organiza la conducta en tres bloques: estabilizacion inmediata, estudios prioritarios y criterio de derivacion/monitoreo.",
    "Estabilizacion: controlar via aerea, respiracion, hemodinamia, dolor y estado neurologico en reevaluaciones seriadas.",
    "Estudios: seleccionar pruebas dirigidas al riesgo principal y al diagnostico diferencial discutido.",
    "Decision: definir umbrales de internacion, interconsulta y signos de alarma para escalamiento inmediato.",
  ],
  [
    "Siguiendo el caso previo, ordena la conducta en etapas para no perder prioridades.",
    "Primero estabiliza funciones vitales y monitoriza cambios clinicos en serie.",
    "Despues orienta estudios al riesgo dominante y a diferenciales con mayor impacto.",
    "Por ultimo define criterios concretos de internacion, interconsulta y escalamiento.",
  ],
  [
    "Para avanzar sin repetir, conviene estructurar el plan en estabilizacion, evaluacion dirigida y decision de destino.",
    "En estabilizacion, prioriza ABC, dolor, perfusion y vigilancia neurologica.",
    "En evaluacion, usa estudios de mayor rendimiento para la hipotesis principal y sus diferenciales.",
    "En destino, fija umbrales de alarma para observacion, derivacion o manejo inmediato.",
  ],
];

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeText(term)));
}

function clip(value: string, max = 220): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).trim()}...`;
}

function buildPatientSummary(context: MetaBrainDecisionInput["context"]): string {
  if (!context.patient) return "No hay paciente seleccionado.";

  const appointmentText = context.current_appointment
    ? `Turno actual ${new Date(context.current_appointment.datetime).toLocaleString("es-AR")} con estado ${context.current_appointment.status}.`
    : "Sin turno actual asociado.";
  const notes = context.clinical_state?.trim() || context.current_appointment?.notes?.trim() || context.patient.notes?.trim() || "Sin observaciones clinicas cargadas.";

  return `Paciente ${context.patient.name}. ${appointmentText} Estado clinico sintetizado: ${clip(notes)}.`;
}

function buildHistorySummary(context: MetaBrainDecisionInput["context"]): string {
  if (context.recent_history.length === 0) return "Sin antecedentes recientes registrados.";

  return context.recent_history
    .slice(0, 3)
    .map((entry, index) => {
      const when = new Date(entry.datetime).toLocaleString("es-AR");
      const notes = clip(entry.notes?.trim() || "Sin notas");
      return `${index + 1}. ${when} | ${entry.status} | ${notes}`;
    })
    .join(" ");
}

function buildConversationSummary(context: MetaBrainDecisionInput["context"]): string {
  if (context.conversation_history.length === 0) return "Sin intercambio previo en este chat.";

  const last = context.conversation_history[context.conversation_history.length - 1];
  return `Ultimo intercambio: doctor=${clip(last.doctor_message, 120)} | respuesta=${clip(last.response, 120)}.`;
}

function pickNonRepeatedContinuation(context: MetaBrainDecisionInput["context"]): string {
  const lastResponse = context.conversation_history[context.conversation_history.length - 1]?.response ?? "";
  const variants = CONTINUATION_VARIANTS.map((parts) => parts.join(" "));
  const candidates = variants.filter((text) => text !== lastResponse);
  const pool = candidates.length > 0 ? candidates : variants;
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatCurrentDateEsAr(): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function asksForCurrentDate(message: string): boolean {
  if (containsAny(message, DATE_QUERY_TERMS)) return true;

  const datePatterns = [
    /\bque\s+dias?\s+es\s+hoy\b/, // cubre "que dia es hoy" y typo/plural "que dias es hoy"
    /\bsabes\s+que\s+dias?\s+es\s+hoy\b/,
    /\ben\s+que\s+dias?\s+estamos\b/,
    /\bque\s+fecha\s+es\s+hoy\b/,
    /\bfecha\s+de\s+hoy\b/,
  ];

  return datePatterns.some((pattern) => pattern.test(message));
}

function decideSocialConversation(message: string): MetaBrainDecision | null {
  const greets = containsAny(message, GREETING_TERMS);
  const asksWellbeing = containsAny(message, WELLBEING_TERMS);
  const asksCurrentDate = asksForCurrentDate(message);

  if (!greets && !asksWellbeing && !asksCurrentDate) return null;

  const responseParts: string[] = [];
  if (greets) {
    responseParts.push("Hola.");
  }

  if (asksWellbeing) {
    responseParts.push("Estoy bien y listo para ayudarte.");
  }

  if (asksCurrentDate) {
    responseParts.push(`Hoy es ${formatCurrentDateEsAr()}.`);
  }

  if (asksWellbeing || asksCurrentDate) {
    responseParts.push("Si queres, seguimos con una consulta clinica puntual.");
  } else {
    responseParts.push("Si queres, contame en que tema clinico te puedo apoyar.");
  }

  return {
    action: asksCurrentDate ? "SOCIAL_DATE_QUERY" : "SOCIAL_GREETING",
    source: "RULES",
    confidence: 0.97,
    response: responseParts.join(" "),
  };
}

function decideUrgent(message: string, context: MetaBrainDecisionInput["context"]): MetaBrainDecision | null {
  if (!containsAny(message, URGENT_TERMS)) return null;

  return {
    action: "ESCALATE_URGENT",
    source: "RULES",
    confidence: 0.94,
    response: [
      "MetaBrain detecto una consulta con criterios de riesgo o alarma.",
      buildPatientSummary(context),
      "Prioriza evaluacion presencial inmediata, documenta signos vitales y tiempo de evolucion, y deriva a guardia si hay compromiso respiratorio, neurologico, hemodinamico o dolor toracico persistente.",
    ].join(" "),
  };
}

function decideChestPainDifferential(message: string): MetaBrainDecision | null {
  const asksChestPain = containsAny(message, CHEST_PAIN_TERMS);
  const asksDifferential = containsAny(message, DIFFERENTIAL_TERMS);
  if (!asksChestPain || !asksDifferential) return null;

  return {
    action: "CHEST_PAIN_DIFFERENTIAL",
    source: "RULES",
    confidence: 0.9,
    response: [
      "Causas comunes de dolor toracico en adulto de 45 anos (orientacion general):",
      "1) Musculoesqueleticas: costocondritis, contractura/intercostalgia, dolor de pared toracica reproducible a palpacion.",
      "2) Gastrointestinales: ERGE, espasmo esofagico, gastritis/dispepsia.",
      "3) Ansiedad/panico: opresion toracica con hiperventilacion, parestesias, miedo intenso.",
      "4) Respiratorias: pleuritis, neumonia, bronquitis; menos frecuente neumotorax.",
      "5) Cardiovasculares a descartar siempre: SCA/angina, pericarditis; y segun contexto TEP o diseccion aortica.",
      "Red flags para derivacion urgente: dolor opresivo persistente >20 min, disnea, diaforesis, nausea/vomitos, sincope, irradiacion a brazo/mandibula/espalda, inestabilidad hemodinamica, saturacion baja o cambios en ECG.",
      "Abordaje inicial sugerido: triage y signos vitales, ECG precoz, troponinas segun ventana temporal, Rx torax si sospecha respiratoria, y estratificacion de riesgo cardiovascular.",
    ].join(" "),
  };
}

function decideContextualContinuation(message: string, context: MetaBrainDecisionInput["context"]): MetaBrainDecision | null {
  if (context.conversation_history.length === 0) return null;

  if (containsAny(message, GREETING_TERMS)) return null;

  const asksContinuation = containsAny(message, CONTINUATION_TERMS);
  if (!asksContinuation) return null;

  const last = context.conversation_history[context.conversation_history.length - 1];
  const threadText = normalizeText(`${last.doctor_message} ${last.response}`);
  const isTceThread = containsAny(threadText, TBI_TERMS) || containsAny(message, TBI_TERMS);

  if (isTceThread) {
    return {
      action: "TBI_CRITICAL_PROTOCOL",
      source: "RULES",
      confidence: 0.93,
      response: [
        "En TCE grave con Glasgow 8, ademas del traslado urgente, prioriza un esquema de estabilizacion ABCDE con inmovilizacion cervical.",
        "Pasos clave: 1) Via aerea y proteccion cervical; considerar via aerea avanzada si no protege reflejos. 2) Oxigenacion y ventilacion objetivo con monitoreo continuo. 3) Evitar hipotension e hipoxia (dos factores que empeoran pronostico neurologico). 4) Dos vias venosas, control de glucemia y temperatura.",
        "En paralelo: TAC de craneo urgente al ingreso, laboratorio inicial (hemograma, coag, ionograma, gases/lactato segun protocolo), y aviso precoz a neurocirugia/UCI.",
        "Si hay signos de hipertension intracraneal o herniacion, activar protocolo institucional de neuroproteccion y manejo osmoterapico segun guia local.",
        "Reevaluar neurologicamente en serie (GCS, pupilas, respuesta motora) y documentar hora de cambios clinicos.",
      ].join(" "),
    };
  }

  return {
    action: "CONTEXTUAL_CONTINUATION",
    source: "RULES",
    confidence: 0.86,
    response: pickNonRepeatedContinuation(context),
  };
}

function decideSummary(message: string, context: MetaBrainDecisionInput["context"]): MetaBrainDecision | null {
  if (!containsAny(message, SUMMARY_TERMS)) return null;

  return {
    action: "SUMMARIZE_CLINICAL_CONTEXT",
    source: "RULES",
    confidence: 0.88,
    response: [
      "Resumen clinico contextual generado por MetaBrain.",
      buildPatientSummary(context),
      `Antecedentes recientes: ${buildHistorySummary(context)}`,
      buildConversationSummary(context),
    ].join(" "),
  };
}

function decideDocumentation(message: string, context: MetaBrainDecisionInput["context"]): MetaBrainDecision | null {
  if (!containsAny(message, DOCUMENTATION_TERMS)) return null;

  const status = context.current_appointment?.status || "scheduled";
  const currentState = context.clinical_state?.trim() || context.current_appointment?.notes?.trim() || "Sin evolucion escrita aun";

  return {
    action: "DOCUMENT_CLINICAL_NOTE",
    source: "RULES",
    confidence: 0.86,
    response: [
      "MetaBrain sugiere documentar la evolucion con estructura breve.",
      `Estado actual del turno: ${status}.`,
      `Base clinica disponible: ${clip(currentState)}.`,
      "Plantilla sugerida: motivo actual, hallazgos relevantes, interpretacion clinica, conducta, plan de control y signos de alarma informados.",
    ].join(" "),
  };
}

function decideFollowUp(message: string, context: MetaBrainDecisionInput["context"]): MetaBrainDecision | null {
  if (!containsAny(message, FOLLOWUP_TERMS)) return null;

  const noShowCount = context.recent_history.filter((item) => item.status === "no_show").length;
  const completedCount = context.recent_history.filter((item) => item.status === "completed").length;
  const followupWindow = noShowCount > 0 ? "48-72 horas" : completedCount > 2 ? "7-14 dias" : "3-7 dias";

  return {
    action: "SUGGEST_FOLLOW_UP",
    source: "RULES",
    confidence: 0.82,
    response: [
      "MetaBrain elaboro una sugerencia de seguimiento usando contexto clinico y antecedentes recientes.",
      buildPatientSummary(context),
      `Ventana sugerida para control: ${followupWindow}. Ajustala al criterio medico, severidad del cuadro y adherencia observada.`,
      `Historial util para decidir: ${buildHistorySummary(context)}`,
    ].join(" "),
  };
}

function decideDefault(context: MetaBrainDecisionInput["context"]): MetaBrainDecision {
  if (!context.patient) {
    return {
      action: "GUIDE_GENERAL",
      source: "RULES",
      confidence: 0.8,
      response: [
        "MetaBrain responde en modo libre para consulta profesional general.",
        "No hay paciente ni turno seleccionado, por lo que la recomendacion no reemplaza juicio clinico individual.",
        "Siguiente paso sugerido: define el problema clinico, factores de riesgo, diferencial inicial, conducta propuesta y criterio de reevaluacion o derivacion.",
      ].join(" "),
    };
  }

  return {
    action: "GUIDE_NEXT_STEP",
    source: "RULES",
    confidence: 0.78,
    response: [
      "MetaBrain no detecto una intencion clinica especifica y devuelve una orientacion general basada en contexto.",
      buildPatientSummary(context),
      `Antecedentes clave: ${buildHistorySummary(context)}`,
      "Siguiente paso sugerido: verificar motivo actual, completar evolucion estructurada, confirmar conducta y definir control o derivacion segun banderas rojas.",
    ].join(" "),
  };
}

async function decideDoctorMessage(input: MetaBrainDecisionInput): Promise<MetaBrainDecision> {
  const message = normalizeText(input.message);

  return (
    decideSocialConversation(message) ||
    decideContextualContinuation(message, input.context) ||
    decideChestPainDifferential(message) ||
    decideUrgent(message, input.context) ||
    decideSummary(message, input.context) ||
    decideDocumentation(message, input.context) ||
    decideFollowUp(message, input.context) ||
    decideDefault(input.context)
  );
}

export const metabrain = {
  async decide(input: MetaBrainDecisionInput): Promise<MetaBrainDecision> {
    if (input.role !== "DOCTOR") {
      return {
        action: "ROLE_NOT_SUPPORTED",
        response: "MetaBrain solo tiene habilitado el modo DOCTOR en esta integracion.",
        confidence: 0.99,
        source: "RULES",
      };
    }

    return await decideDoctorMessage(input);
  },
};

export function buildImagingClinicalGuidance(input: ImagingMetaBrainInput): MetaBrainDecision {
  const region = normalizeText(input.region);
  const findings = input.findings.map((item) => normalizeText(item));

  const warning = "Analisis asistido por IA: no reemplaza diagnostico medico ni informe radiologico final.";
  let recommendation = "Correlacionar con estudio completo, clinica del paciente e interconsulta con especialista.";

  if (region.includes("chest") && findings.some((item) => item.includes("fractura"))) {
    recommendation = "Considerar evaluacion traumatologica y control de complicaciones toracicas segun clinica.";
  } else if (region.includes("spine")) {
    recommendation = "Evaluar compromiso neurologico y considerar derivacion prioritaria si hay deficit motor/sensitivo.";
  } else if (region.includes("knee")) {
    recommendation = "Complementar con serie completa de rodilla y examen fisico dirigido de estabilidad y meniscos.";
  }

  return {
    action: "IMAGING_GUIDANCE",
    source: "RULES",
    confidence: Number(Math.max(0.6, Math.min(0.98, input.confidence)).toFixed(2)),
    response: [
      `Clasificacion preliminar: estudio ${input.study_type}, region ${input.region}.`,
      `Hallazgos sugeridos: ${input.findings.join(" | ") || "sin hallazgos evidentes"}.`,
      recommendation,
      warning,
    ].join(" "),
  };
}
