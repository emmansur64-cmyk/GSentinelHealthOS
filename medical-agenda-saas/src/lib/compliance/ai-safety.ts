type EmergencyDetection = {
  detected: boolean;
  reason?: string;
};

const EMERGENCY_PATTERNS: Array<{ reason: string; regex: RegExp }> = [
  { reason: "dolor_de_pecho", regex: /dolor\s+de\s+pecho|opresion\s+en\s+el\s+pecho|pecho\s+oprimido/i },
  { reason: "dificultad_respiratoria", regex: /falta\s+de\s+aire|dificultad\s+para\s+respirar|no\s+puedo\s+respirar|disnea/i },
  { reason: "perdida_conciencia", regex: /desmayo|perd[ií]\s+el\s+conocimiento|inconsciente/i },
  { reason: "acv", regex: /acv|derrame|desviacion\s+de\s+boca|no\s+puede\s+mover\s+un\s+lado/i },
  { reason: "sangrado_severo", regex: /sangrado\s+abundante|hemorragia|sangra\s+mucho/i },
  { reason: "ideacion_suicida", regex: /me\s+quiero\s+matar|quiero\s+morir|suicid/i },
  { reason: "embarazo_grave", regex: /embaraz[ao].*(sangrado|dolor\s+fuerte|sin\s+movimientos|fiebre)/i },
];

const DEFINITIVE_DIAGNOSIS = /(diagn[oó]stico\s+definitivo|seguro\s+que\s+ten[eé]s|confirmado\s+que\s+ten[eé]s)/i;
const DANGEROUS_THERAPY = /(tom[aá]\s+\d+\s*mg|duplic[aá]\s+la\s+dosis|suspend[eé]\s+de\s+golpe|mezcl[aá]\s+con\s+alcohol)/i;

export function detectEmergency(text: string): EmergencyDetection {
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.regex.test(text)) {
      return { detected: true, reason: pattern.reason };
    }
  }

  return { detected: false };
}

export function buildEmergencyEscalationMessage() {
  return "Por los síntomas que describís, esto puede ser una emergencia. Llamá al 107/911 o acudí a una guardia de inmediato. Si podés, no vayas solo/a.";
}

export function enforceSafeMedicalResponse(response: string) {
  const sanitized = String(response ?? "").trim();

  if (DEFINITIVE_DIAGNOSIS.test(sanitized) || DANGEROUS_THERAPY.test(sanitized)) {
    return "No puedo confirmar diagnósticos definitivos ni indicar cambios terapéuticos riesgosos por este canal. Te recomiendo evaluación médica presencial o por teleconsulta con profesional matriculado.";
  }

  return sanitized;
}

export function appendMedicalDisclaimer(response: string) {
  const base = String(response ?? "").trim();
  const disclaimer = "\n\nAviso: esta respuesta es orientación inicial y no reemplaza la evaluación médica profesional.";

  if (!base) return disclaimer.trim();
  if (/no reemplaza la evaluaci[oó]n m[eé]dica/i.test(base)) return base;
  return `${base}${disclaimer}`;
}
