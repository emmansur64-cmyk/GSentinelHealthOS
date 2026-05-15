import type { MedicalReasoningSpecialty } from "./types";

type SpecialtyAdapter = {
  specialty: MedicalReasoningSpecialty;
  patterns: RegExp[];
  guidance: string[];
};

const ADAPTERS: SpecialtyAdapter[] = [
  {
    specialty: "psychiatry",
    patterns: [/\b(psiquiatr|depresion|depresión|ansiedad|suicid|psicosis|bipolar|autolesion|autolesión)\b/i],
    guidance: [
      "Incluir riesgo suicida/autolesivo, psicosis, consumo de sustancias y red de apoyo si es relevante.",
      "Evitar lenguaje determinista y recomendar evaluacion presencial urgente ante riesgo de dano.",
    ],
  },
  {
    specialty: "pediatrics",
    patterns: [/\b(pediatr|niño|nino|niña|nina|lactante|bebe|bebé|adolescente|fiebre en menor)\b/i],
    guidance: [
      "Considerar edad, peso, hidratacion, vacunacion, signos de dificultad respiratoria y estado general.",
      "Evitar dosis concretas si no hay peso/edad suficientes.",
    ],
  },
  {
    specialty: "internal_medicine",
    patterns: [/\b(diabetes|hipertension|hipertensión|renal|hepatic|cardiovascular|disnea|dolor toracico|dolor torácico|fiebre|sepsis)\b/i],
    guidance: [
      "Ordenar comorbilidades, medicacion habitual, signos vitales y criterios de derivacion.",
      "Priorizar diagnosticos diferenciales de alto riesgo cuando existan red flags.",
    ],
  },
];

export function detectMedicalReasoningSpecialty(text: string): { specialty: MedicalReasoningSpecialty; guidance: string[] } {
  for (const adapter of ADAPTERS) {
    if (adapter.patterns.some((pattern) => pattern.test(text))) {
      return { specialty: adapter.specialty, guidance: adapter.guidance };
    }
  }
  return {
    specialty: "general",
    guidance: ["Mantener enfoque clinico general, diferencial amplio y recomendaciones prudentes."],
  };
}

