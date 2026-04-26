/**
 * Load Generator for Stress Testing
 *
 * Genera mensajes WhatsApp realistas para pruebas de carga.
 * Los mensajes simulan solicitudes de turnos médicos.
 */
import { v4 as uuidv4 } from "uuid";
import { createHmac } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MessageIntent = "create" | "reschedule" | "cancel" | "query" | "greeting";

export interface GeneratedMessage {
  id: string;
  phone: string;
  contactName: string;
  text: string;
  intent: MessageIntent;
  timestamp: number;
  /** Para tests de idempotencia: si es duplicado de otro mensaje */
  isDuplicate: boolean;
  originalMessageId?: string;
}

export interface WebhookPayload {
  object: "whatsapp_business_account";
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: "whatsapp";
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: "text";
          text: { body: string };
        }>;
      };
      field: "messages";
    }>;
  }>;
}

export interface GeneratorConfig {
  /** Número total de mensajes a generar */
  count: number;
  /** Distribución de intents (debe sumar 100) */
  distribution?: {
    create: number;
    reschedule: number;
    cancel: number;
    query?: number;
    greeting?: number;
  };
  /** Porcentaje de mensajes duplicados intencionales (0-100) */
  duplicateRate?: number;
  /** Generar usuarios únicos o reusar algunos */
  uniqueUsers?: boolean;
  /** Pool de usuarios a reusar */
  userPoolSize?: number;
}

// ─── Message Templates ───────────────────────────────────────────────────────

const CREATE_TEMPLATES = [
  "Quiero un turno para mañana",
  "Necesito turno urgente",
  "Hola, quiero sacar turno",
  "Buenos días, necesito un turno",
  "Tenés turno disponible para hoy?",
  "Quiero turno con el doctor López",
  "Necesito turno para esta semana",
  "Me podrían dar un turno?",
  "Turno para consulta general",
  "Quiero agendar una cita",
  "Turno para el lunes",
  "Necesito ver a un médico",
  "Hay lugar para mañana a la tarde?",
  "Quiero reservar un turno",
  "Buenas, turno por favor",
];

const RESCHEDULE_TEMPLATES = [
  "Quiero cambiar mi turno",
  "Puedo reprogramar el turno?",
  "Necesito mover mi cita",
  "Cambiar turno para otro día",
  "Tengo que postergar mi turno",
  "Puedo pasar mi turno al viernes?",
  "Mover turno a la tarde",
  "Reprogramar cita por favor",
];

const CANCEL_TEMPLATES = [
  "Cancelar mi turno",
  "Anular turno",
  "No voy a poder ir, cancelar",
  "Quiero cancelar la cita",
  "Cancelo el turno de mañana",
  "Tengo que cancelar",
  "No puedo asistir, cancelen",
];

const QUERY_TEMPLATES = [
  "Qué turnos tengo?",
  "Cuándo es mi próximo turno?",
  "Ver mis citas",
  "Mis turnos agendados",
  "Tengo algún turno?",
];

const GREETING_TEMPLATES = [
  "Hola",
  "Buenos días",
  "Buenas tardes",
  "Hola buenas",
];

const FIRST_NAMES = [
  "María", "Juan", "Carlos", "Ana", "Luis", "Sofía", "Pedro", "Laura",
  "Diego", "Valentina", "Martín", "Camila", "Federico", "Lucía", "Santiago",
  "Florencia", "Andrés", "Julieta", "Ignacio", "Carolina", "Tomás", "Paula",
  "Nicolás", "Agustina", "Matías", "Victoria", "Gabriel", "Rocío", "Lucas",
  "Milagros", "Maximiliano", "Daniela", "Sebastián", "Micaela", "Emiliano",
];

const LAST_NAMES = [
  "García", "Rodríguez", "Martínez", "López", "González", "Pérez", "Sánchez",
  "Romero", "Torres", "Díaz", "Fernández", "Ruiz", "Álvarez", "Gómez", "Moreno",
  "Muñoz", "Jiménez", "Hernández", "Castro", "Vargas", "Medina", "Silva", "Molina",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePhone(): string {
  const area = randomElement(["11", "351", "261", "341", "381"]);
  const number = Math.floor(10000000 + Math.random() * 89999999);
  return `549${area}${number}`;
}

function generateName(): string {
  return `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)}`;
}

function generateMessageId(): string {
  return `wamid.${uuidv4().replace(/-/g, "")}`;
}

function getTemplateForIntent(intent: MessageIntent): string {
  switch (intent) {
    case "create":
      return randomElement(CREATE_TEMPLATES);
    case "reschedule":
      return randomElement(RESCHEDULE_TEMPLATES);
    case "cancel":
      return randomElement(CANCEL_TEMPLATES);
    case "query":
      return randomElement(QUERY_TEMPLATES);
    case "greeting":
      return randomElement(GREETING_TEMPLATES);
  }
}

function selectIntent(distribution: Required<GeneratorConfig>["distribution"]): MessageIntent {
  const rand = Math.random() * 100;
  let cumulative = 0;

  cumulative += distribution.create;
  if (rand < cumulative) return "create";

  cumulative += distribution.reschedule;
  if (rand < cumulative) return "reschedule";

  cumulative += distribution.cancel;
  if (rand < cumulative) return "cancel";

  cumulative += distribution.query ?? 0;
  if (rand < cumulative) return "query";

  return "greeting";
}

// ─── Main Generator ──────────────────────────────────────────────────────────

/**
 * Genera N mensajes WhatsApp realistas para stress testing.
 */
export function generateMessages(config: GeneratorConfig): GeneratedMessage[] {
  const {
    count,
    distribution = { create: 70, reschedule: 20, cancel: 10, query: 0, greeting: 0 },
    duplicateRate = 5,
    uniqueUsers = true,
    userPoolSize = 50,
  } = config;

  const messages: GeneratedMessage[] = [];
  const userPool: Array<{ phone: string; name: string }> = [];

  // Pre-generar pool de usuarios si no son únicos
  if (!uniqueUsers) {
    for (let i = 0; i < userPoolSize; i++) {
      userPool.push({ phone: generatePhone(), name: generateName() });
    }
  }

  // Generar mensajes principales
  const mainCount = Math.floor(count * (1 - duplicateRate / 100));
  const duplicateCount = count - mainCount;

  for (let i = 0; i < mainCount; i++) {
    const user = uniqueUsers
      ? { phone: generatePhone(), name: generateName() }
      : randomElement(userPool);

    const intent = selectIntent(distribution);

    messages.push({
      id: generateMessageId(),
      phone: user.phone,
      contactName: user.name,
      text: getTemplateForIntent(intent),
      intent,
      timestamp: Date.now(),
      isDuplicate: false,
    });
  }

  // Agregar duplicados intencionales (para probar idempotencia)
  for (let i = 0; i < duplicateCount && messages.length > 0; i++) {
    const original = randomElement(messages.filter((m) => !m.isDuplicate));
    messages.push({
      ...original,
      // Mismo messageId = duplicado real de WhatsApp
      isDuplicate: true,
      originalMessageId: original.id,
      timestamp: Date.now() + Math.random() * 100, // Pequeño offset
    });
  }

  // Mezclar para que los duplicados no estén al final
  return shuffleArray(messages);
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── Webhook Payload Builder ─────────────────────────────────────────────────

const DEFAULT_PHONE_NUMBER_ID = "test_phone_id_12345";
const DEFAULT_DISPLAY_NUMBER = "15551234567";

/**
 * Convierte un mensaje generado en un payload de webhook de WhatsApp.
 */
export function buildWebhookPayload(message: GeneratedMessage): WebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: uuidv4(),
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: DEFAULT_DISPLAY_NUMBER,
                phone_number_id: DEFAULT_PHONE_NUMBER_ID,
              },
              contacts: [
                {
                  profile: { name: message.contactName },
                  wa_id: message.phone,
                },
              ],
              messages: [
                {
                  id: message.id,
                  from: message.phone,
                  timestamp: String(Math.floor(message.timestamp / 1000)),
                  type: "text",
                  text: { body: message.text },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

/**
 * Genera firma HMAC-SHA256 para el payload.
 */
export function signPayload(payload: string, appSecret: string): string {
  return "sha256=" + createHmac("sha256", appSecret).update(payload).digest("hex");
}

// ─── Batch Generators ────────────────────────────────────────────────────────

/**
 * Genera mensajes para el test de concurrencia crítica:
 * N usuarios intentando reservar el mismo horario.
 */
export function generateConcurrentSlotConflict(
  count: number,
  targetSlot?: string,
): GeneratedMessage[] {
  const slot = targetSlot || "mañana a las 10";
  const messages: GeneratedMessage[] = [];

  for (let i = 0; i < count; i++) {
    messages.push({
      id: generateMessageId(),
      phone: generatePhone(),
      contactName: generateName(),
      text: `Quiero turno para ${slot}`,
      intent: "create",
      timestamp: Date.now(),
      isDuplicate: false,
    });
  }

  return messages;
}

/**
 * Genera una ráfaga de mensajes del mismo usuario (para probar rate limiting).
 */
export function generateUserBurst(
  phone: string,
  name: string,
  count: number,
): GeneratedMessage[] {
  const messages: GeneratedMessage[] = [];

  for (let i = 0; i < count; i++) {
    messages.push({
      id: generateMessageId(),
      phone,
      contactName: name,
      text: `Mensaje ${i + 1}: ${getTemplateForIntent("create")}`,
      intent: "create",
      timestamp: Date.now() + i,
      isDuplicate: false,
    });
  }

  return messages;
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface GeneratorStats {
  total: number;
  byIntent: Record<MessageIntent, number>;
  uniqueUsers: number;
  duplicates: number;
}

export function getGeneratorStats(messages: GeneratedMessage[]): GeneratorStats {
  const byIntent: Record<MessageIntent, number> = {
    create: 0,
    reschedule: 0,
    cancel: 0,
    query: 0,
    greeting: 0,
  };

  const phones = new Set<string>();
  let duplicates = 0;

  for (const msg of messages) {
    byIntent[msg.intent]++;
    phones.add(msg.phone);
    if (msg.isDuplicate) duplicates++;
  }

  return {
    total: messages.length,
    byIntent,
    uniqueUsers: phones.size,
    duplicates,
  };
}
