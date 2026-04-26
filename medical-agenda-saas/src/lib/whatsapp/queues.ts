/**
 * Definición de colas BullMQ para procesamiento escalable de WhatsApp.
 *
 * Arquitectura de 3 etapas:
 * 1. INTAKE: Recibe mensaje crudo, valida, enriquece
 * 2. PROCESSING: Ejecuta lógica de negocio con lock por usuario
 * 3. RESPONSE: Envía respuesta vía WhatsApp API
 *
 * Esta separación permite:
 * - Escalar cada etapa independientemente
 * - Retry granular por etapa
 * - Métricas específicas por stage
 */
import { Queue, type JobsOptions } from "bullmq";
import { getRedisConnection } from "./redis";
import { observeRedisLatency, setQueueActive } from "@/lib/observability/metrics";

// ─── Nombres de Colas ────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  INTAKE: "wa-intake",
  PROCESSING: "wa-processing",
  RESPONSE: "wa-response",
  /** Cola legacy para compatibilidad */
  LEGACY: "whatsapp-incoming",
} as const;

// ─── Tipos de Jobs ───────────────────────────────────────────────────────────

export type IntakeJobData = {
  messageId: string;
  receivedAt: number;
};

export type ProcessingJobData = {
  messageId: string;
  phone: string;
  text: string;
  payload: Record<string, unknown>;
  receivedAt: number;
  intakeCompletedAt: number;
};

export type ResponseJobData = {
  messageId: string;
  phone: string;
  reply: string;
  intent: string;
  action?: string;
  receivedAt: number;
  processingCompletedAt: number;
};

// ─── Configuración de Jobs ───────────────────────────────────────────────────

const INTAKE_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { count: 5000 },
  removeOnFail: { count: 10000 },
};

const PROCESSING_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { count: 5000 },
  removeOnFail: { count: 10000 },
};

const RESPONSE_JOB_OPTIONS: JobsOptions = {
  attempts: 10, // más reintentos para entrega
  backoff: { type: "exponential", delay: 500 },
  removeOnComplete: { count: 5000 },
  removeOnFail: { count: 10000 },
};

// ─── Singleton Queues ────────────────────────────────────────────────────────

const queues: Map<string, Queue> = new Map();

function getQueue<T>(name: string, defaultJobOptions: JobsOptions): Queue<T> {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue<T>(name, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
    queues.set(name, queue);
  }
  return queue as Queue<T>;
}

export function getIntakeQueue(): Queue<IntakeJobData> {
  return getQueue<IntakeJobData>(QUEUE_NAMES.INTAKE, INTAKE_JOB_OPTIONS);
}

export function getProcessingQueue(): Queue<ProcessingJobData> {
  return getQueue<ProcessingJobData>(QUEUE_NAMES.PROCESSING, PROCESSING_JOB_OPTIONS);
}

export function getResponseQueue(): Queue<ResponseJobData> {
  return getQueue<ResponseJobData>(QUEUE_NAMES.RESPONSE, RESPONSE_JOB_OPTIONS);
}

// ─── Enqueue Helpers ─────────────────────────────────────────────────────────

/**
 * Encola un mensaje entrante en la etapa de intake.
 * Usa messageId como jobId para idempotencia.
 */
export async function enqueueIntake(messageId: string): Promise<void> {
  const queue = getIntakeQueue();
  const started = performance.now();
  await queue.add(
    "intake",
    { messageId, receivedAt: Date.now() },
    { jobId: `intake-${messageId}`, priority: 1 },
  );
  observeRedisLatency("queue_add_intake", performance.now() - started);
}

/**
 * Encola para procesamiento después del intake.
 */
export async function enqueueProcessing(data: ProcessingJobData): Promise<void> {
  const queue = getProcessingQueue();
  // Priority basada en hash del teléfono para distribuir carga
  const priority = Math.abs(hashCode(data.phone) % 10) + 1;
  const started = performance.now();
  await queue.add(
    "process",
    data,
    { jobId: `process-${data.messageId}`, priority },
  );
  observeRedisLatency("queue_add_processing", performance.now() - started);
}

/**
 * Encola para envío de respuesta.
 */
export async function enqueueResponse(data: ResponseJobData): Promise<void> {
  const queue = getResponseQueue();
  const started = performance.now();
  await queue.add(
    "respond",
    data,
    { jobId: `respond-${data.messageId}`, priority: 1 },
  );
  observeRedisLatency("queue_add_response", performance.now() - started);
}

// ─── Estadísticas de Colas ───────────────────────────────────────────────────

export type QueueStats = {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

export async function getQueueStats(queueName: string): Promise<QueueStats> {
  const queue = queues.get(queueName);
  if (!queue) {
    return { name: queueName, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  setQueueActive(queueName, active);

  return { name: queueName, waiting, active, completed, failed, delayed };
}

export async function getAllQueueStats(): Promise<QueueStats[]> {
  return Promise.all([
    getQueueStats(QUEUE_NAMES.INTAKE),
    getQueueStats(QUEUE_NAMES.PROCESSING),
    getQueueStats(QUEUE_NAMES.RESPONSE),
  ]);
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export async function closeAllQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((q) => q.close());
  await Promise.all(closePromises);
  queues.clear();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}
