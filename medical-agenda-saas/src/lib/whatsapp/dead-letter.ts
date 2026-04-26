/**
 * Dead Letter Queue (DLQ) para mensajes WhatsApp fallidos.
 *
 * Funcionalidad:
 * - Persiste mensajes fallidos en DB
 * - Permite reintento manual
 * - Dashboard para secretaria/admin
 *
 * NUNCA se pierde un mensaje.
 */
import { Queue, type Job } from "bullmq";
import { getRedisConnection } from "./redis";
import { prisma } from "@/lib/prisma";
import { logServer, logServerError } from "@/lib/server-logger";

export const DLQ_QUEUE_NAME = "whatsapp-dead-letter";

let _dlqQueue: Queue | null = null;

// ─── DLQ Queue ───────────────────────────────────────────────────────────────

export function getDLQQueue(): Queue {
  if (!_dlqQueue) {
    _dlqQueue = new Queue(DLQ_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        // DLQ no reintenta automáticamente
        attempts: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: false, // Mantener para auditoría
      },
    });
  }
  return _dlqQueue;
}

// ─── Mover mensaje a DLQ ─────────────────────────────────────────────────────

export type DLQJobData = {
  messageId: string;
  originalJobId: string;
  fromPhone: string;
  payloadJson: unknown;
  errorMessage: string;
  errorStack?: string;
  retryCount: number;
  maxRetries: number;
};

/**
 * Persiste un mensaje fallido en la base de datos y encola en DLQ.
 * Esta función es llamada cuando un job agota todos sus reintentos.
 */
export async function moveToDeadLetter(
  job: Job,
  error: Error,
): Promise<void> {
  const { messageId } = job.data as { messageId: string };

  try {
    // 1. Obtener datos del mensaje original
    const incoming = await prisma.incomingMessage.findUnique({
      where: { message_id: messageId },
      select: {
        from_phone: true,
        payload_json: true,
      },
    });

    if (!incoming) {
      logServerError("dlq.message_not_found", new Error("Message not found"), {
        messageId,
        jobId: job.id,
      });
      return;
    }

    // 2. Persistir en tabla failed_messages (idempotente por message_id)
    await prisma.failedMessage.upsert({
      where: { message_id: messageId },
      create: {
        message_id: messageId,
        job_id: job.id ?? null,
        from_phone: incoming.from_phone,
        payload_json: incoming.payload_json ?? {},
        error_message: error.message,
        error_stack: error.stack ?? null,
        retry_count: job.attemptsMade,
        max_retries: job.opts.attempts ?? 5,
        last_attempt: new Date(),
        status: "pending",
      },
      update: {
        error_message: error.message,
        error_stack: error.stack ?? null,
        retry_count: job.attemptsMade,
        last_attempt: new Date(),
        status: "pending",
      },
    });

    // 3. Encolar en DLQ para procesamiento adicional (notificaciones, etc)
    const dlq = getDLQQueue();
    await dlq.add(
      "failed-message",
      {
        messageId,
        originalJobId: job.id ?? "",
        fromPhone: incoming.from_phone,
        payloadJson: incoming.payload_json,
        errorMessage: error.message,
        errorStack: error.stack,
        retryCount: job.attemptsMade,
        maxRetries: job.opts.attempts ?? 5,
      } satisfies DLQJobData,
      {
        jobId: `dlq-${messageId}`,
      },
    );

    // 4. Actualizar estado del mensaje original
    await prisma.incomingMessage.update({
      where: { message_id: messageId },
      data: { status: "failed", error: error.message.slice(0, 1000) },
    });

    logServer("warn", "dlq.message_moved", {
      messageId,
      jobId: job.id,
      retryCount: job.attemptsMade,
      error: error.message,
    });
  } catch (err) {
    // CRÍTICO: No podemos perder el mensaje
    // Loguear con máximo detalle para recuperación manual
    logServerError("dlq.persistence_failed", err, {
      messageId,
      jobId: job.id,
      originalError: error.message,
      CRITICAL: true,
      // Incluir datos para recuperación manual
      jobData: JSON.stringify(job.data),
      attemptsMade: job.attemptsMade,
    });
  }
}

// ─── Reintento Manual ────────────────────────────────────────────────────────

import { getWhatsAppQueue } from "./queue";

export type RetryResult = {
  success: boolean;
  message: string;
  jobId?: string;
};

/**
 * Reintenta manualmente un mensaje fallido.
 * Solo usuarios autorizados (secretaria/admin) pueden ejecutar esto.
 */
export async function retryFailedMessage(
  failedMessageId: string,
  userId: string,
): Promise<RetryResult> {
  // 1. Obtener mensaje fallido
  const failed = await prisma.failedMessage.findFirst({
    where: { id: failedMessageId },
  });

  if (!failed) {
    return { success: false, message: "Mensaje no encontrado" };
  }

  if (failed.status === "resolved") {
    return { success: false, message: "Mensaje ya fue resuelto" };
  }

  if (failed.status === "retrying") {
    return { success: false, message: "Mensaje ya está en proceso de reintento" };
  }

  try {
    // 2. Marcar como retrying
    await prisma.failedMessage.updateMany({
      where: { id: failedMessageId },
      data: {
        status: "retrying",
        retry_count: { increment: 1 },
        last_attempt: new Date(),
      },
    });

    // 3. Resetear estado del mensaje original a pending
    await prisma.incomingMessage.update({
      where: { message_id: failed.message_id },
      data: {
        status: "pending",
        error: null,
      },
    });

    // 4. Re-encolar en cola principal
    const queue = getWhatsAppQueue();
    const job = await queue.add(
      "process-message",
      { messageId: failed.message_id },
      {
        jobId: `wa-retry-${failed.message_id}-${Date.now()}`,
        priority: 0, // Alta prioridad para reintentos manuales
      },
    );

    logServer("info", "dlq.manual_retry", {
      failedMessageId,
      messageId: failed.message_id,
      newJobId: job.id,
      userId,
    });

    return {
      success: true,
      message: "Mensaje reencolado para procesamiento",
      jobId: job.id,
    };
  } catch (error) {
    // Revertir estado
    await prisma.failedMessage.updateMany({
      where: { id: failedMessageId },
      data: { status: "pending" },
    }).catch(() => { /* best effort */ });

    logServerError("dlq.retry_failed", error, {
      failedMessageId,
      userId,
    });

    return {
      success: false,
      message: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

// ─── Marcar como resuelto ────────────────────────────────────────────────────

/**
 * Marca un mensaje fallido como resuelto (manualmente o por reintento exitoso).
 */
export async function resolveFailedMessage(
  failedMessageId: string,
  userId: string,
  notes?: string,
): Promise<void> {
  await prisma.failedMessage.updateMany({
    where: { id: failedMessageId },
    data: {
      status: "resolved",
      resolved_at: new Date(),
      resolved_by: userId,
      notes: notes ?? null,
    },
  });

  logServer("info", "dlq.message_resolved", {
    failedMessageId,
    userId,
  });
}

/**
 * Descarta un mensaje fallido (no se reintentará).
 */
export async function discardFailedMessage(
  failedMessageId: string,
  userId: string,
  reason: string,
): Promise<void> {
  await prisma.failedMessage.updateMany({
    where: { id: failedMessageId },
    data: {
      status: "discarded",
      resolved_at: new Date(),
      resolved_by: userId,
      notes: reason,
    },
  });

  logServer("info", "dlq.message_discarded", {
    failedMessageId,
    userId,
    reason,
  });
}

// ─── Listener para marcar como resuelto automáticamente ──────────────────────

/**
 * Call this when a message is successfully processed.
 * Si el mensaje estaba en DLQ, lo marca como resuelto.
 */
export async function markAsResolvedIfRetry(messageId: string): Promise<void> {
  try {
    const failed = await prisma.failedMessage.findFirst({
      where: { message_id: messageId },
      select: { id: true, status: true },
    });

    if (failed && failed.status === "retrying") {
      await prisma.failedMessage.updateMany({
        where: { id: failed.id },
        data: {
          status: "resolved",
          resolved_at: new Date(),
          notes: "Resuelto automáticamente por reintento exitoso",
        },
      });

      logServer("info", "dlq.auto_resolved", { messageId });
    }
  } catch {
    // Non-critical, don't fail the main flow
  }
}

// ─── Consultas ───────────────────────────────────────────────────────────────

export type FailedMessageSummary = {
  id: string;
  message_id: string;
  from_phone: string;
  error_message: string;
  retry_count: number;
  status: string;
  last_attempt: Date;
  created_at: Date;
};

/**
 * Lista mensajes fallidos para el dashboard.
 */
export async function listFailedMessages(options: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: FailedMessageSummary[]; total: number }> {
  const where = options.status ? { status: options.status as never } : {};

  const [items, total] = await Promise.all([
    prisma.failedMessage.findMany({
      where,
      select: {
        id: true,
        message_id: true,
        from_phone: true,
        error_message: true,
        retry_count: true,
        status: true,
        last_attempt: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.failedMessage.count({ where }),
  ]);

  return { items, total };
}

/**
 * Obtiene detalles completos de un mensaje fallido.
 */
export async function getFailedMessageDetail(id: string) {
  return prisma.failedMessage.findFirst({
    where: { id },
  });
}

/**
 * Estadísticas para el dashboard.
 */
export async function getFailedMessageStats(): Promise<{
  pending: number;
  retrying: number;
  resolved: number;
  discarded: number;
  total: number;
}> {
  const [pending, retrying, resolved, discarded] = await Promise.all([
    prisma.failedMessage.count({ where: { status: "pending" } }),
    prisma.failedMessage.count({ where: { status: "retrying" } }),
    prisma.failedMessage.count({ where: { status: "resolved" } }),
    prisma.failedMessage.count({ where: { status: "discarded" } }),
  ]);

  return {
    pending,
    retrying,
    resolved,
    discarded,
    total: pending + retrying + resolved + discarded,
  };
}
