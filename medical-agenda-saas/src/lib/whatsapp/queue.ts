import { Queue } from "bullmq";
import { getRedisConnection } from "./redis";
import { enqueueIntake } from "./queues";

export const WHATSAPP_QUEUE_NAME = "whatsapp-incoming";

let _queue: Queue | null = null;

/**
 * @deprecated Usar getIntakeQueue() de ./queues para el nuevo sistema escalable.
 */
export function getWhatsAppQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(WHATSAPP_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return _queue;
}

export type WhatsAppJobData = {
  messageId: string;
};

/**
 * Encola un mensaje entrante para procesamiento asíncrono.
 * Usa el nuevo sistema de colas escalables (intake → processing → response).
 */
export async function enqueueIncomingMessage(messageId: string): Promise<void> {
  // Usar el nuevo sistema de colas escalables
  await enqueueIntake(messageId);
}
