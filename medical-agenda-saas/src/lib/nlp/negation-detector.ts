/**
 * Detección de negaciones en español para el motor de intents.
 *
 * Este módulo detecta cuando el usuario niega una acción que el sistema
 * clasifica como positiva. Ejemplo: "no quiero cancelar" es clasificado
 * como CANCEL pero la negación indica que el usuario NO quiere cancelar.
 *
 * 100% determinístico, sin IA.
 */

import type { Intent } from "@/lib/whatsapp/intent-parser";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type NegationResult = {
  /** Indica si se detectó una negación */
  detected: boolean;
  /** Patrón específico que matcheó */
  pattern?: string;
  /** Intent original que fue negado */
  originalIntent?: Intent;
  /** Indica si se debe bloquear la ejecución de la acción */
  blockExecution: boolean;
  /** Mensaje sugerido para responder al usuario */
  suggestedReply?: string;
};

// ─── Intents críticos que requieren detección de negación ────────────────────

const CRITICAL_INTENTS: Set<Intent> = new Set([
  "cancel_appointment",
  "reschedule_appointment",
]);

// ─── Patrones de negación ────────────────────────────────────────────────────

// Verbos que pueden ser negados en contexto de turnos
const CRITICAL_VERBS = [
  "cancelar",
  "cancelo",
  "cancele",
  "canceles",
  "anular",
  "anulo",
  "anule",
  "anules",
  "borrar",
  "borro",
  "borre",
  "borres",
  "eliminar",
  "elimino",
  "elimine",
  "elimines",
  "cambiar",
  "cambio",
  "cambie",
  "cambies",
  "mover",
  "muevo",
  "mueva",
  "muevas",
  "reprogramar",
  "reprogramo",
  "reprograme",
  "reprogrames",
  "postergar",
  "postergo",
  "postergue",
  "postergues",
  "adelantar",
  "adelanto",
  "adelante",
  "adelantes",
  "modificar",
  "modifico",
  "modifique",
  "modifiques",
];

// Patrones de negación directa: "no + verbo" o "no + quiero/intento + verbo"
const NEGATION_PATTERNS: Array<{
  pattern: RegExp;
  name: string;
  intents: Intent[];
}> = [
  // "no quiero cancelar", "no quiero cambiar"
  {
    pattern: new RegExp(
      `\\bno\\s+(quiero|necesito|deseo|voy\\s+a)\\s+(${CRITICAL_VERBS.join("|")})`,
      "i"
    ),
    name: "no_quiero_verbo",
    intents: ["cancel_appointment", "reschedule_appointment"],
  },
  // "no lo canceles", "no canceles nada"
  {
    pattern: new RegExp(
      `\\bno\\s+(lo\\s+)?(${CRITICAL_VERBS.join("|")})`,
      "i"
    ),
    name: "no_verbo_directo",
    intents: ["cancel_appointment", "reschedule_appointment"],
  },
  // "mejor no", "prefiero no"
  {
    pattern: /\b(mejor|prefiero)\s+no\b/i,
    name: "mejor_prefiero_no",
    intents: ["cancel_appointment", "reschedule_appointment"],
  },
  // "nunca" + verbo crítico
  {
    pattern: new RegExp(
      `\\bnunca\\s+(quise|quiero|dije|pedi)\\s+(${CRITICAL_VERBS.join("|")})?`,
      "i"
    ),
    name: "nunca_verbo",
    intents: ["cancel_appointment", "reschedule_appointment"],
  },
  // "no dije que" + verbo (malentendido)
  {
    pattern: new RegExp(
      `\\bno\\s+(dije|pedi)\\s+(que\\s+)?(${CRITICAL_VERBS.join("|")})`,
      "i"
    ),
    name: "no_dije_verbo",
    intents: ["cancel_appointment", "reschedule_appointment"],
  },
  // "no toques" / "no cambies nada" / "dejalo asi"
  {
    pattern: /\bno\s+(toques?|cambies?)\s+(nada|el\s+turno|la\s+cita)/i,
    name: "no_toques_nada",
    intents: ["cancel_appointment", "reschedule_appointment"],
  },
  {
    pattern: /\b(dejalo|dejá?lo)\s+(asi|como\s+esta)/i,
    name: "dejalo_asi",
    intents: ["cancel_appointment", "reschedule_appointment"],
  },
  // "sin cancelar", "sin cambiar"
  {
    pattern: new RegExp(
      `\\bsin\\s+(${CRITICAL_VERBS.join("|")})`,
      "i"
    ),
    name: "sin_verbo",
    intents: ["cancel_appointment", "reschedule_appointment"],
  },
  // "no era para cancelar"
  {
    pattern: new RegExp(
      `\\bno\\s+(era|es)\\s+(para|que)\\s+(${CRITICAL_VERBS.join("|")})`,
      "i"
    ),
    name: "no_era_para",
    intents: ["cancel_appointment", "reschedule_appointment"],
  },
];

// Patrones de disponibilidad temporal (afectan reschedule pero no son negación de acción)
// Nota: Los patrones usan versiones sin acentos porque normalizeText() los elimina
const AVAILABILITY_NEGATION_PATTERNS: Array<{
  pattern: RegExp;
  name: string;
}> = [
  // "no puedo ese día", "no puedo mañana" - indica falta de disponibilidad, no negación de reschedule
  {
    pattern: /\bno\s+puedo\s+(ese|el|la|manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo)/i,
    name: "no_puedo_fecha",
  },
  // "no voy a poder ir"
  {
    pattern: /\bno\s+(voy\s+a\s+)?poder\s+(ir|asistir)/i,
    name: "no_poder_ir",
  },
  // "no me queda bien ese horario" / "no me sirve el lunes"
  {
    pattern: /\bno\s+me\s+(queda|viene|sirve)\s+(bien|ese|el\s+\w+)/i,
    name: "no_me_queda_bien",
  },
];

// ─── Mensajes de respuesta según el contexto ─────────────────────────────────

const REPLY_TEMPLATES: Record<Intent, string> = {
  cancel_appointment:
    "Entiendo que *no* querés cancelar el turno. Tu turno sigue confirmado. ¿Necesitás algo más?",
  reschedule_appointment:
    "Entiendo que *no* querés cambiar el turno. Queda como está. ¿Puedo ayudarte con otra cosa?",
  create_appointment: "",
  query_appointment: "",
  greeting: "",
  help: "",
  confirm: "",
  deny: "",
  unknown: "",
};

// ─── Función principal ───────────────────────────────────────────────────────

/**
 * Detecta si el mensaje contiene una negación que invalida el intent detectado.
 *
 * @param message - Texto del mensaje del usuario
 * @param detectedIntent - Intent clasificado por el parser
 * @returns Resultado con información de la negación detectada
 *
 * @example
 * detectNegation("no quiero cancelar", "cancel_appointment")
 * // => { detected: true, blockExecution: true, ... }
 *
 * detectNegation("quiero cancelar mi turno", "cancel_appointment")
 * // => { detected: false, blockExecution: false }
 */
export function detectNegation(
  message: string,
  detectedIntent: Intent
): NegationResult {
  // Si el intent no es crítico, no buscamos negaciones
  if (!CRITICAL_INTENTS.has(detectedIntent)) {
    return { detected: false, blockExecution: false };
  }

  const normalizedMessage = normalizeText(message);

  // Buscar patrones de negación directa
  for (const { pattern, name, intents } of NEGATION_PATTERNS) {
    if (intents.includes(detectedIntent) && pattern.test(normalizedMessage)) {
      return {
        detected: true,
        pattern: name,
        originalIntent: detectedIntent,
        blockExecution: true,
        suggestedReply: REPLY_TEMPLATES[detectedIntent],
      };
    }
  }

  // Patrones de disponibilidad NO bloquean la acción, solo informan
  // Ejemplo: "no puedo mañana" en contexto de reschedule indica que quiere otro día
  for (const { pattern, name } of AVAILABILITY_NEGATION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      // Esta es una negación de disponibilidad, no de la acción
      // No bloqueamos pero marcamos para contexto
      return {
        detected: true,
        pattern: name,
        originalIntent: detectedIntent,
        blockExecution: false, // No bloquear, el usuario SÍ quiere reprogramar
      };
    }
  }

  return { detected: false, blockExecution: false };
}

/**
 * Versión estricta que solo detecta negaciones que DEBEN bloquear la acción.
 * Ignora negaciones de disponibilidad temporal.
 */
export function detectBlockingNegation(
  message: string,
  detectedIntent: Intent
): NegationResult {
  const result = detectNegation(message, detectedIntent);
  if (result.detected && !result.blockExecution) {
    // Es negación de disponibilidad, no de acción
    return { detected: false, blockExecution: false };
  }
  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normaliza el texto para matching más robusto.
 * - Convierte a minúsculas
 * - Normaliza acentos comunes
 * - Elimina puntuación duplicada
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents for matching
    .replace(/[!¡?¿.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Analiza un mensaje y devuelve todas las negaciones encontradas.
 * Útil para debugging y logging.
 */
export function analyzeNegations(message: string): Array<{
  pattern: string;
  match: string;
  type: "action" | "availability";
}> {
  const normalizedMessage = normalizeText(message);
  const results: Array<{ pattern: string; match: string; type: "action" | "availability" }> = [];

  for (const { pattern, name } of NEGATION_PATTERNS) {
    const match = normalizedMessage.match(pattern);
    if (match) {
      results.push({
        pattern: name,
        match: match[0],
        type: "action",
      });
    }
  }

  for (const { pattern, name } of AVAILABILITY_NEGATION_PATTERNS) {
    const match = normalizedMessage.match(pattern);
    if (match) {
      results.push({
        pattern: name,
        match: match[0],
        type: "availability",
      });
    }
  }

  return results;
}

// ─── Exports adicionales para testing ────────────────────────────────────────

export const _internal = {
  CRITICAL_INTENTS,
  NEGATION_PATTERNS,
  AVAILABILITY_NEGATION_PATTERNS,
  normalizeText,
};
