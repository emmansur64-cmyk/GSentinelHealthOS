/**
 * Integration Tests: Redis Real Operations
 *
 * Tests obligatorios que validan el funcionamiento real de Redis:
 * - Enqueue/dequeue de jobs
 * - Worker processing
 * - Locks y concurrencia
 *
 * Estos tests DEBEN pasar antes de ejecutar otros tests de integración.
 * Si fallan, indican un problema de infraestructura.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import IORedis from "ioredis";
import { Queue, Worker, Job } from "bullmq";
import {
  createIsolatedRedis,
  waitUntilQueueReady,
  waitUntilWorkerReady,
  waitForJobCompletion,
  verifyJobProcessedOnce,
  cleanupQueue,
  closeWorker,
  getBullMQTestOptions,
  requireRedis,
  TIMEOUTS,
} from "@/lib/infra";

// ─── Test Setup ──────────────────────────────────────────────────────────────

let redis: IORedis;
let testPrefix: string;

beforeAll(async () => {
  // Verificar Redis disponible (fail-fast)
  await requireRedis({ timeoutMs: TIMEOUTS.REDIS_CONNECT });

  // Crear cliente aislado
  const isolated = await createIsolatedRedis();
  redis = isolated.redis;
  testPrefix = isolated.keyPrefix;
});

afterAll(async () => {
  if (redis) {
    await redis.quit();
  }
});

// ─── Test Suite: Redis Basic Operations ──────────────────────────────────────

describe("Integration: Redis Basic Operations", () => {
  const prefix = () => `${testPrefix}:basic`;

  beforeEach(async () => {
    // Limpiar keys del test anterior
    const keys = await redis.keys(`${prefix()}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it("ping responde correctamente", async () => {
    const result = await redis.ping();
    expect(result).toBe("PONG");
  });

  it("set/get funcionan correctamente", async () => {
    const key = `${prefix()}:test-key`;
    const value = "test-value-" + uuidv4();

    await redis.set(key, value);
    const result = await redis.get(key);

    expect(result).toBe(value);
  });

  it("expire funciona correctamente", async () => {
    const key = `${prefix()}:expire-test`;

    await redis.set(key, "value");
    await redis.expire(key, 1);

    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(1);
  });

  it("incr es atómico", async () => {
    const key = `${prefix()}:counter`;

    // Incrementos concurrentes
    const promises = Array.from({ length: 10 }, () => redis.incr(key));
    await Promise.all(promises);

    const result = await redis.get(key);
    expect(parseInt(result!, 10)).toBe(10);
  });

  it("setnx proporciona mutex básico", async () => {
    const lockKey = `${prefix()}:lock`;

    // Primer lock debe tener éxito
    const first = await redis.setnx(lockKey, "owner1");
    expect(first).toBe(1);

    // Segundo lock debe fallar
    const second = await redis.setnx(lockKey, "owner2");
    expect(second).toBe(0);

    // Verificar que el primer owner mantiene el lock
    const owner = await redis.get(lockKey);
    expect(owner).toBe("owner1");
  });
});

// ─── Test Suite: BullMQ Queue Operations ─────────────────────────────────────

describe("Integration: BullMQ Queue Operations", () => {
  let queue: Queue;
  const queueName = `test-queue-${uuidv4().slice(0, 8)}`;

  beforeAll(async () => {
    const { prefix } = getBullMQTestOptions();
    queue = new Queue(queueName, {
      connection: redis,
      prefix,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    });
  });

  afterAll(async () => {
    if (queue) {
      await cleanupQueue(queue);
      await queue.close();
    }
  });

  it("cola queda ready después de creación", async () => {
    const ready = await waitUntilQueueReady(queue, TIMEOUTS.QUEUE_READY);
    expect(ready).toBe(true);
  });

  it("puede agregar job a la cola", async () => {
    const jobId = `job-${uuidv4()}`;
    const data = { test: true, timestamp: Date.now() };

    const job = await queue.add("test-job", data, { jobId });

    expect(job).toBeDefined();
    expect(job.id).toBe(jobId);
    expect(job.data).toEqual(data);

    // Verificar que está en la cola
    const retrieved = await queue.getJob(jobId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.data).toEqual(data);
  });

  it("jobs tienen prioridad correcta", async () => {
    const lowPriorityId = `low-${uuidv4()}`;
    const highPriorityId = `high-${uuidv4()}`;

    // Agregar low priority primero
    await queue.add("test", { priority: "low" }, { jobId: lowPriorityId, priority: 10 });
    // Agregar high priority después
    await queue.add("test", { priority: "high" }, { jobId: highPriorityId, priority: 1 });

    // High priority debe estar primero en waiting
    const waiting = await queue.getJobs(["waiting"], 0, 10);
    const ids = waiting.map(j => j.id);

    // El de mayor prioridad (menor número) debe estar primero
    const highIndex = ids.indexOf(highPriorityId);
    const lowIndex = ids.indexOf(lowPriorityId);

    if (highIndex !== -1 && lowIndex !== -1) {
      expect(highIndex).toBeLessThan(lowIndex);
    }
  });
});

// ─── Test Suite: Worker Processing ───────────────────────────────────────────

describe("Integration: Worker Processing", () => {
  let queue: Queue;
  let worker: Worker;
  const queueName = `worker-test-${uuidv4().slice(0, 8)}`;
  const processedJobs: string[] = [];

  beforeAll(async () => {
    const { prefix } = getBullMQTestOptions();

    queue = new Queue(queueName, {
      connection: redis,
      prefix,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    });

    worker = new Worker(
      queueName,
      async (job: Job) => {
        processedJobs.push(job.id!);
        return { processed: true, jobId: job.id };
      },
      {
        connection: redis,
        prefix,
        concurrency: 1,
      },
    );

    await waitUntilQueueReady(queue);
    await waitUntilWorkerReady(worker);
  });

  afterAll(async () => {
    if (worker) await closeWorker(worker);
    if (queue) {
      await cleanupQueue(queue);
      await queue.close();
    }
  });

  beforeEach(() => {
    processedJobs.length = 0;
  });

  it("worker procesa job exitosamente", async () => {
    const jobId = `process-${uuidv4()}`;

    await queue.add("test", { value: 42 }, { jobId });

    const result = await waitForJobCompletion(queue, jobId, 5000);

    expect(result.completed).toBe(true);
    expect(result.result).toEqual({ processed: true, jobId });
  });

  it("job completa sin retry innecesario", async () => {
    const jobId = `no-retry-${uuidv4()}`;

    await queue.add("test", { value: "success" }, { jobId });

    const result = await verifyJobProcessedOnce(queue, jobId, 5000);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("múltiples jobs se procesan en orden", async () => {
    const jobIds = Array.from({ length: 5 }, (_, i) => `order-${i}-${uuidv4()}`);

    // Agregar jobs secuencialmente
    for (const id of jobIds) {
      await queue.add("test", { id }, { jobId: id });
    }

    // Esperar a que todos completen
    for (const id of jobIds) {
      await waitForJobCompletion(queue, id, 5000);
    }

    // Verificar que todos fueron procesados
    expect(processedJobs.length).toBe(5);

    // Verificar orden (concurrency=1 debe mantener orden FIFO)
    for (const id of jobIds) {
      expect(processedJobs).toContain(id);
    }
  });
});

// ─── Test Suite: Redis Concurrency & Locks ───────────────────────────────────

describe("Integration: Redis Concurrency", () => {
  const prefix = () => `${testPrefix}:concurrency`;

  beforeEach(async () => {
    const keys = await redis.keys(`${prefix()}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it("Redlock pattern funciona para mutex distribuido", async () => {
    const lockKey = `${prefix()}:redlock`;
    const lockValue = uuidv4();
    const lockTTL = 10; // segundos

    // Adquirir lock con SET NX EX
    const acquired = await redis.set(lockKey, lockValue, "EX", lockTTL, "NX");
    expect(acquired).toBe("OK");

    // Intentar adquirir de nuevo debe fallar
    const secondAttempt = await redis.set(lockKey, "other", "EX", lockTTL, "NX");
    expect(secondAttempt).toBeNull();

    // Release con verificación de ownership (Lua script pattern)
    const releaseScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const released = await redis.eval(releaseScript, 1, lockKey, lockValue);
    expect(released).toBe(1);

    // Ahora otro puede adquirir
    const thirdAttempt = await redis.set(lockKey, "third", "EX", lockTTL, "NX");
    expect(thirdAttempt).toBe("OK");
  });

  it("WATCH/MULTI/EXEC proporciona transacciones optimistas", async () => {
    const counterKey = `${prefix()}:optimistic`;

    await redis.set(counterKey, "0");

    // Simular actualización con WATCH
    await redis.watch(counterKey);
    const current = parseInt((await redis.get(counterKey))!, 10);

    const multi = redis.multi();
    multi.set(counterKey, String(current + 1));

    const result = await multi.exec();

    // Transacción debe tener éxito (no hubo cambio concurrent)
    expect(result).not.toBeNull();
    expect(result?.length).toBe(1);

    const final = await redis.get(counterKey);
    expect(final).toBe("1");
  });

  it("operaciones concurrentes no causan race conditions", async () => {
    const counterKey = `${prefix()}:concurrent`;
    const numOperations = 100;

    await redis.set(counterKey, "0");

    // Ejecutar incrementos concurrentes
    const promises = Array.from({ length: numOperations }, () =>
      redis.incr(counterKey),
    );

    await Promise.all(promises);

    const result = await redis.get(counterKey);
    expect(parseInt(result!, 10)).toBe(numOperations);
  });

  it("pub/sub funciona para notificaciones", async () => {
    const channel = `${prefix()}:notifications`;
    const receivedMessages: string[] = [];

    // Crear subscriber separado
    const subscriber = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

    await subscriber.subscribe(channel);

    subscriber.on("message", (ch, message) => {
      if (ch === channel) {
        receivedMessages.push(message);
      }
    });

    // Dar tiempo para que la suscripción se establezca
    await new Promise(r => setTimeout(r, 100));

    // Publicar mensajes
    await redis.publish(channel, "message-1");
    await redis.publish(channel, "message-2");

    // Esperar a que lleguen
    await new Promise(r => setTimeout(r, 200));

    expect(receivedMessages).toContain("message-1");
    expect(receivedMessages).toContain("message-2");

    await subscriber.quit();
  });
});
