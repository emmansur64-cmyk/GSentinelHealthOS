export const STRUCTURED_MEDICAL_REASONING_SECTIONS = [
  "Resumen clinico",
  "Hipotesis",
  "Factores de riesgo",
  "Red flags",
  "Evidencia utilizada",
  "Sugerencias de evaluacion",
  "Limitaciones",
  "Disclaimer clinico",
];

export const STRUCTURED_MEDICAL_REASONING_INSTRUCTION = [
  "Responder con razonamiento medico estructurado y util para un profesional.",
  "Usar exactamente las secciones solicitadas cuando la consulta sea clinica.",
  "No afirmar diagnosticos absolutos.",
  "No reemplazar criterio medico.",
  "No inventar evidencia ni fuentes.",
  "Si no hay evidencia externa controlada, decir que no se uso evidencia externa y basarse solo en contexto provisto y conocimiento general.",
].join(" ");

