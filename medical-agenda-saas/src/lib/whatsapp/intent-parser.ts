import { z } from "zod";

/**
 * Intenciones soportadas por el motor conversacional.
 */
export type Intent =
  | "create_appointment"
  | "query_appointment"
  | "cancel_appointment"
  | "reschedule_appointment"
  | "greeting"
  | "help"
  | "confirm"
  | "deny"
  | "unknown";

export type ParsedIntent = {
  intent: Intent;
  confidence: number;
  entities: {
    doctor_name?: string;
    date?: string;
    time?: string;
    specialty?: string;
  };
};

// Patrones para detección de intención basada en reglas.
// Se puede reemplazar por un LLM para mayor precisión.
const PATTERNS: Array<{ intent: Intent; patterns: RegExp[]; confidence: number }> = [
  {
    intent: "cancel_appointment",
    patterns: [
      /\b(cancelar|anular|borrar|eliminar)\s+(mi\s+)?(turno|cita)/i,
      /\bno\s+(puedo|voy)\s+(ir|asistir)/i,
    ],
    confidence: 0.9,
  },
  {
    intent: "reschedule_appointment",
    patterns: [
      /\b(reprogramar|cambiar|mover|postergar|adelantar)\s+(mi\s+)?(turno|cita)/i,
      /\b(cambiar|mover)\s+(de\s+)?(horario|fecha|dia)/i,
    ],
    confidence: 0.85,
  },
  {
    intent: "query_appointment",
    patterns: [
      /\b(consultar|ver|cuando|tengo)\s+(mi\s+)?(turno|cita|proximo)/i,
      /\bmis?\s+(turno|cita)s?\b/i,
      /\b(proximo|siguiente)\s+(turno|cita)\b/i,
    ],
    confidence: 0.85,
  },
  {
    intent: "confirm",
    patterns: [
      /^(si|s[ií]|ok|dale|confirmo|perfecto|bueno|genial|listo)\s*[.!]?\s*$/i,
      /\bconfirm(o|ar)\b/i,
    ],
    confidence: 0.95,
  },
  {
    intent: "deny",
    patterns: [
      /^(no|nop|nel|nah|negativo)\s*[.!]?\s*$/i,
      /\bno\s+(quiero|gracias)\b/i,
    ],
    confidence: 0.95,
  },
  {
    intent: "greeting",
    patterns: [
      /^(hola|buenas?|hey|hi|buenos?\s+dias?|buenas?\s+tardes?|buenas?\s+noches?)\s*[.!]?\s*$/i,
    ],
    confidence: 0.9,
  },
  {
    intent: "help",
    patterns: [
      /\b(ayuda|menu|opciones|help|que\s+puedo)\b/i,
    ],
    confidence: 0.9,
  },
  {
    intent: "create_appointment",
    patterns: [
      /\b(turno|cita|reserv|agend|sacar|pedir)\b/i,
      /\b(necesito|preciso|quiero)\s+(un\s+)?(turno|cita|ver\s+al\s+doctor|reservar|agendar)/i,
      /\bquiero\s+(reservar|agendar|sacar)/i,
    ],
    confidence: 0.85,
  },
];

// Extracción de entidades básicas
const TIME_REGEX = /\b(\d{1,2})[:\s]?(\d{2})?\s*(hs?|am|pm|de\s+la\s+(ma[nñ]ana|tarde|noche))?\b/i;
const DATE_KEYWORDS: Record<string, () => string> = {
  hoy: () => todayISO(),
  "mañana": () => tomorrowISO(),
  "manana": () => tomorrowISO(),
  lunes: () => nextWeekday(1),
  martes: () => nextWeekday(2),
  "miércoles": () => nextWeekday(3),
  miercoles: () => nextWeekday(3),
  jueves: () => nextWeekday(4),
  viernes: () => nextWeekday(5),
  "sábado": () => nextWeekday(6),
  sabado: () => nextWeekday(6),
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nextWeekday(target: number): string {
  const now = new Date();
  const current = now.getDay();
  const diff = (target - current + 7) % 7 || 7;
  now.setDate(now.getDate() + diff);
  return now.toISOString().slice(0, 10);
}

function extractEntities(text: string): ParsedIntent["entities"] {
  const entities: ParsedIntent["entities"] = {};

  // Extraer fecha
  const lower = text.toLowerCase();
  for (const [keyword, fn] of Object.entries(DATE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      entities.date = fn();
      break;
    }
  }

  // Extraer hora
  const timeMatch = text.match(TIME_REGEX);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2] ?? "0", 10);
    const period = timeMatch[3]?.toLowerCase();

    if (period?.includes("pm") || period?.includes("tarde") || period?.includes("noche")) {
      if (hours < 12) hours += 12;
    } else if (period?.includes("am") || period?.includes("mañana") || period?.includes("manana")) {
      if (hours === 12) hours = 0;
    }

    entities.time = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  // Extraer especialidad
  const specialties = [
    "clinica", "cardiologia", "dermatologia", "pediatria",
    "ginecologia", "traumatologia", "oftalmologia", "neurologia",
    "medicina general", "general",
  ];
  for (const sp of specialties) {
    if (lower.includes(sp)) {
      entities.specialty = sp;
      break;
    }
  }

  return entities;
}

/**
 * Dado un texto de mensaje, detecta la intención y extrae entidades.
 */
export function parseIntent(text: string): ParsedIntent {
  const trimmed = text.trim();
  if (!trimmed) {
    return { intent: "unknown", confidence: 0, entities: {} };
  }

  for (const { intent, patterns, confidence } of PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return {
          intent,
          confidence,
          entities: extractEntities(trimmed),
        };
      }
    }
  }

  // Si no matchea patrones pero tiene entidades de turno, asumir creación
  const entities = extractEntities(trimmed);
  if (entities.date || entities.time || entities.specialty) {
    return {
      intent: "create_appointment",
      confidence: 0.5,
      entities,
    };
  }

  return { intent: "unknown", confidence: 0, entities: {} };
}
