/**
 * Processing Worker: Segunda etapa del pipeline - Lógica de negocio.
 *
 * Responsabilidades:
 * - Adquirir lock por usuario (pg_advisory_lock)
 * - Ejecutar lógica conversacional
 * - Manejar rate limiting
 * - Pasar resultado a cola de response
 *
 * El lock por usuario garantiza que mensajes del mismo usuario
 * se procesen serialmente, evitando race conditions en el contexto.
 */
import { Worker, type Job } from "bullmq";
import { v4 as uuidv4 } from "uuid";

import { prisma } from "@/lib/prisma";
import { logServer, logServerError } from "@/lib/server-logger";
import { parseIntent, type Intent } from "@/lib/whatsapp/intent-parser";
import { generateWhatsAppMetaBrainReply } from "@/lib/whatsapp/metabrain-assistant";
import { detectBlockingNegation } from "@/lib/nlp";
import { checkRateLimit } from "@/lib/whatsapp/rate-limiter";
import { getRedisConnection } from "./redis";
import {
  QUEUE_NAMES,
  type ProcessingJobData,
  enqueueResponse,
} from "./queues";
import {
  trackJobStart,
  trackJobComplete,
  workerHeartbeat,
} from "./worker-metrics";
import { moveToDeadLetter } from "./dead-letter";
import { runWithObservabilityContext, createTraceId, enrichObservabilityContext } from "@/lib/observability/context";
import { withSpan } from "@/lib/observability/tracing";
import { observeStageLatency } from "@/lib/observability/metrics";

// ─── Configuración ───────────────────────────────────────────────────────────

export type ProcessingWorkerConfig = {
  /** Número de jobs concurrentes (default: 10) */
  concurrency?: number;
  /** ID único del worker (auto-generado si no se provee) */
  workerId?: string;
  /** Timeout para adquirir lock en ms (default: 5000) */
  lockTimeoutMs?: number;
  /** Intervalo de heartbeat en ms (default: 10000) */
  heartbeatIntervalMs?: number;
};

const DEFAULT_CONFIG: Required<ProcessingWorkerConfig> = {
  concurrency: 10,
  workerId: `processing-${uuidv4().slice(0, 8)}`,
  lockTimeoutMs: 5000,
  heartbeatIntervalMs: 10000,
};

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ConversationContext = {
  doctor_id?: string;
  doctor_name?: string;
  patient_id?: string;
  proposed_time?: string;
  proposed_slot_end?: string;
  duration?: number;
  step?: string;
  specialty?: string;
  pending_appointment_id?: string;
  last_metabrain_action?: string;
  last_metabrain_source?: string;
  last_metabrain_confidence?: number;
};

type ProcessResult = {
  reply: string;
  intent: Intent;
  action?: string;
  newContext?: ConversationContext;
};

// ─── Worker ──────────────────────────────────────────────────────────────────

let _worker: Worker | null = null;
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let _config: Required<ProcessingWorkerConfig> = DEFAULT_CONFIG;

export function startProcessingWorker(config: ProcessingWorkerConfig = {}): Worker {
  if (_worker) return _worker;

  _config = { ...DEFAULT_CONFIG, ...config };
  const connection = getRedisConnection();

  logServer("info", "processing_worker.starting", {
    workerId: _config.workerId,
    concurrency: _config.concurrency,
  });

  _worker = new Worker<ProcessingJobData>(
    QUEUE_NAMES.PROCESSING,
    async (job: Job<ProcessingJobData>) => {
      const startTime = await trackJobStart("processing", job.id!);
      let success = false;

      try {
        await processJob(job);
        success = true;
      } finally {
        await trackJobComplete("processing", job.id!, startTime, success);
      }
    },
    {
      connection,
      concurrency: _config.concurrency,
      // Sin limiter global: el lock por usuario ya serializa
    },
  );

  // Heartbeat
  _heartbeatInterval = setInterval(() => {
    workerHeartbeat(_config.workerId, "processing").catch(() => {});
  }, _config.heartbeatIntervalMs);
  workerHeartbeat(_config.workerId, "processing").catch(() => {});

  _worker.on("failed", async (job, error) => {
    logServerError("processing_worker.job_failed", error, {
      jobId: job?.id,
      messageId: job?.data.messageId,
      phone: job?.data.phone,
      attempt: job?.attemptsMade,
    });

    // Si agotó reintentos, mover a DLQ
    if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
      try {
        await moveToDeadLetter(job, error);
      } catch (dlqError) {
        logServerError("processing_worker.dlq_failed", dlqError, {
          messageId: job.data.messageId,
        });
      }
    }
  });

  _worker.on("error", (error) => {
    logServerError("processing_worker.error", error, { workerId: _config.workerId });
  });

  return _worker;
}

export async function stopProcessingWorker(): Promise<void> {
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
}

// ─── Job Handler ─────────────────────────────────────────────────────────────

async function processJob(job: Job<ProcessingJobData>): Promise<void> {
  const { messageId, phone, text, payload, receivedAt, intakeCompletedAt } = job.data;

  await runWithObservabilityContext(
    { traceId: createTraceId(), messageId, userPhone: phone },
    async () => {
  logServer("debug", "processing.start", {
    messageId,
    phone,
    jobId: job.id,
  });

  // Ejecutar con lock por usuario dentro de transacción
  const processingStart = performance.now();
  const result = await withSpan("queue_processing", { queue: QUEUE_NAMES.PROCESSING }, async () => prisma.$transaction(
    async (tx) => {
      // 1. Adquirir lock exclusivo por usuario (basado en hash del teléfono)
      // pg_advisory_xact_lock se libera automáticamente al terminar la transacción
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wa_user:${phone}`}))`;

      // 2. Verificar que el mensaje aún está en processing
      const current = await tx.incomingMessage.findUnique({
        where: { message_id: messageId },
        select: { status: true },
      });

      if (current?.status !== "processing") {
        logServer("info", "processing.skip_status_changed", {
          messageId,
          status: current?.status,
        });
        return null; // Ya procesado por otro worker
      }

      // 3. Rate limiting
      const allowed = await checkRateLimit(phone);
      if (!allowed) {
        return {
          reply: "Estas enviando muchos mensajes. Espera un minuto e intenta de nuevo.",
          intent: "unknown" as Intent,
          action: "rate_limited",
        } satisfies ProcessResult;
      }

      // 4. Obtener/crear contexto conversacional
      const state = await tx.conversationState.upsert({
        where: { phone },
        update: {},
        create: { phone, context_json: {} },
      });
      const context = (state.context_json ?? {}) as ConversationContext;

      // 5. Procesar mensaje (lógica de negocio)
      const processResult = await withSpan(
        "classify_intent",
        { component: "intent_parser" },
        async () => handleMessage(tx, phone, text, context, payload),
      );

      enrichObservabilityContext({ intent: processResult.intent });

      // 6. Actualizar contexto
      await tx.conversationState.update({
        where: { phone },
        data: {
          last_intent: processResult.intent,
          context_json: processResult.newContext ?? context,
        },
      });

      return processResult;
    },
    {
      timeout: _config.lockTimeoutMs + 10000, // timeout mayor que lock timeout
      isolationLevel: "ReadCommitted",
    },
  ));

  observeStageLatency("ia_processing", performance.now() - processingStart);

  if (!result) return; // Ya procesado

  // 7. Encolar para response
  await enqueueResponse({
    messageId,
    phone,
    reply: result.reply,
    intent: result.intent,
    action: result.action,
    receivedAt,
    processingCompletedAt: Date.now(),
  });

  logServer("debug", "processing.complete", {
    messageId,
    phone,
    intent: result.intent,
    action: result.action,
    processingLatencyMs: Date.now() - intakeCompletedAt,
    totalLatencyMs: Date.now() - receivedAt,
  });
    },
  );
}

// ─── Message Handler ─────────────────────────────────────────────────────────
// Importa la lógica del conversation-engine pero en contexto de transacción

const MENU_TEXT = `Hola! Soy el asistente de turnos. Puedo ayudarte con:

1. *Sacar turno* - Reservar un nuevo turno
2. *Mis turnos* - Consultar tus turnos
3. *Cancelar turno* - Cancelar un turno existente
4. *Reprogramar turno* - Cambiar fecha/hora

Escribi lo que necesites!`;

async function handleMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  phone: string,
  text: string,
  context: ConversationContext,
  payload: Record<string, unknown>,
): Promise<ProcessResult & { newContext?: ConversationContext }> {
  // Interactive reply handling
  if (payload.interactiveReplyId) {
    const replyId = payload.interactiveReplyId as string;
    if (replyId.startsWith("confirm_")) {
      // Delegar a handleConfirmAppointment del conversation-engine
      // Por ahora retornamos placeholder - en producción importar la función
      return {
        reply: "Turno confirmado! Te enviaremos un recordatorio.",
        intent: "confirm",
        action: "confirmed",
        newContext: {},
      };
    }
    if (replyId.startsWith("deny_")) {
      return {
        reply: "Entendido, turno cancelado. Te puedo ayudar con otra cosa?",
        intent: "deny",
        action: "denied",
        newContext: {},
      };
    }
  }

  const metabrainReply = await generateWhatsAppMetaBrainReply({
    tx,
    phone,
    text,
    contactName: typeof payload.contactName === "string" ? payload.contactName : undefined,
    context: context as Record<string, unknown>,
  });

  if (metabrainReply) {
    return {
      reply: metabrainReply.response,
      intent: "unknown",
      action: `metabrain:${metabrainReply.action}`,
      newContext: {
        ...context,
        last_metabrain_action: metabrainReply.action,
        last_metabrain_source: metabrainReply.source,
        last_metabrain_confidence: metabrainReply.confidence,
      },
    };
  }

  const parsed = parseIntent(text);

  // Detección de negaciones
  const negation = detectBlockingNegation(text, parsed.intent);
  if (negation.detected && negation.blockExecution) {
    logServer("info", "processing.negation_detected", {
      phone,
      text,
      originalIntent: negation.originalIntent,
    });
    return {
      reply: negation.suggestedReply ?? "Entendido. Puedo ayudarte con algo mas?",
      intent: "deny",
      action: "negated_action",
      newContext: context,
    };
  }

  // Flujo de confirmación
  if (context.step === "confirming") {
    if (parsed.intent === "confirm") {
      return {
        reply: "Turno confirmado! Te enviaremos un recordatorio.",
        intent: "confirm",
        action: "confirmed",
        newContext: {},
      };
    }
    if (parsed.intent === "deny") {
      return {
        reply: "Turno no confirmado. Queres buscar otro horario?",
        intent: "deny",
        action: "denied",
        newContext: {},
      };
    }
  }

  // Dispatch por intent
  switch (parsed.intent) {
    case "greeting":
    case "help":
      return { reply: MENU_TEXT, intent: parsed.intent, newContext: {} };

    case "create_appointment":
      // Simplified - en producción importar desde conversation-engine
      return {
        reply: "Para que especialidad necesitas turno?",
        intent: "create_appointment",
        action: "ask_specialty",
        newContext: { step: "asking_specialty" },
      };

    case "query_appointment":
      // Consultar turnos del paciente
      const patient = await tx.patient.findFirst({
        where: { phone },
        include: {
          appointments: {
            where: { status: "planned", deleted_at: null },
            orderBy: { datetime: "asc" },
            take: 5,
            include: { doctor: { include: { user: { select: { name: true } } } } },
          },
        },
      });

      if (!patient || patient.appointments.length === 0) {
        return {
          reply: "No tenes turnos programados. Queres sacar uno?",
          intent: "query_appointment",
          action: "no_appointments",
        };
      }

      const apptList = patient.appointments
        .map((a: { datetime: Date; doctor: { user: { name: string } } }) => {
          const dt = new Date(a.datetime);
          return `- ${dt.toLocaleDateString("es-AR")} ${dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} con ${a.doctor.user.name}`;
        })
        .join("\n");

      return {
        reply: `Tus proximos turnos:\n${apptList}`,
        intent: "query_appointment",
        action: "listed",
      };

    case "cancel_appointment":
      return {
        reply: "Cual turno queres cancelar? Decime la fecha o el nombre del doctor.",
        intent: "cancel_appointment",
        action: "ask_which",
        newContext: { step: "asking_cancel_which" },
      };

    case "reschedule_appointment":
      return {
        reply: "Cual turno queres reprogramar?",
        intent: "reschedule_appointment",
        action: "ask_which",
        newContext: { step: "asking_reschedule_which" },
      };

    default:
      return {
        reply: "No entendi tu mensaje. Queres sacar un turno?\n\n" + MENU_TEXT,
        intent: "unknown",
      };
  }
}
