const SPECIALTY_CONTEXT: Array<{ pattern: RegExp; guidance: string[] }> = [
  {
    pattern: /\b(cardio|cardiolog|dolor toracico|dolor torácico)\b/i,
    guidance: ["Priorizar riesgo cardiovascular, estabilidad hemodinamica y red flags tiempo-dependientes."],
  },
  {
    pattern: /\b(psiquiatr|depresion|depresión|ansiedad|psicosis|suicid)\b/i,
    guidance: ["Usar lenguaje no estigmatizante y evaluar seguridad, riesgo autolesivo y red de apoyo."],
  },
  {
    pattern: /\b(pediatr|niño|nino|niña|nina|lactante|adolescente)\b/i,
    guidance: ["Considerar edad, peso, desarrollo, vacunacion, hidratacion y signos respiratorios."],
  },
  {
    pattern: /\b(neuro|neurolog|acv|cefalea|convulsion|convulsión)\b/i,
    guidance: ["Ordenar inicio temporal, focalidad neurologica, conciencia y necesidad de evaluacion urgente."],
  },
  {
    pattern: /\b(endo|diabetes|tiroides|glucemia|metabol)\b/i,
    guidance: ["Considerar medicacion, adherencia, comorbilidades y urgencias metabolicas."],
  },
];

export function buildSpecialtyContext(specialty: string): string[] {
  const match = SPECIALTY_CONTEXT.find((item) => item.pattern.test(specialty));
  return match?.guidance ?? ["Mantener enfoque de medicina general, diferencial amplio y limites explicitos."];
}
