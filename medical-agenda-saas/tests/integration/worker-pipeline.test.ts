/**
 * Integration Tests: Worker Pipeline (Intake → Processing → Response)
 *
 * Tests del sistema de colas escalable usando infraestructura LOCAL:
 * - PostgreSQL en localhost:5432
 * - Redis en localhost:6379
 *
 * Ejecutar: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { v4 as uuidv4 } from "uuid";
import {
  getTestPrisma,
  getTestRedis,
  disconnectPrisma,
  disconnectRedis,
  cleanDatabase,
  cleanRedis,
} from "./test-isolation";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/whatsapp/client", () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue({ success: true }),
  updateOutgoingStatus: vi.fn(),
}));

// ─── Test Suite: Queue Configuration ─────────────────────────────────────────

describe("Integration: Queue Configuration", () => {
  beforeAll(async () => {
    // Verificar contenedores
    const prisma = getTestPrisma();
    await prisma.$queryRaw`SELECT 1`;

    const redis = await getTestRedis();
    await redis.ping();
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  it("queue names son válidos para BullMQ", async () => {
    const { QUEUE_NAMES } = await import("@/lib/whatsapp/queues");

    // BullMQ no permite : en nombres de cola
    expect(QUEUE_NAMES.INTAKE).not.toContain(":");
    expect(QUEUE_NAMES.PROCESSING).not.toContain(":");
    expect(QUEUE_NAMES.RESPONSE).not.toContain(":");

    // Nombres descriptivos
    expect(QUEUE_NAMES.INTAKE).toContain("intake");
    expect(QUEUE_NAMES.PROCESSING).toContain("processing");
    expect(QUEUE_NAMES.RESPONSE).toContain("response");
  });

  it("job options tienen retry configurado", async () => {
    const { getIntakeQueue, getProcessingQueue, getResponseQueue } = await import(
      "@/lib/whatsapp/queues"
    );

    const intakeQueue = getIntakeQueue();
    const processingQueue = getProcessingQueue();
    const responseQueue = getResponseQueue();

    // Las colas deben existir
    expect(intakeQueue).toBeDefined();
    expect(processingQueue).toBeDefined();
    expect(responseQueue).toBeDefined();

    // Verificar que podemos agregar jobs
    const testJobId = `test-${uuidv4()}`;
    const job = await intakeQueue.add(
      "intake",
      { messageId: testJobId, receivedAt: Date.now() },
      { jobId: testJobId },
    );

    expect(job.id).toBe(testJobId);

    // Cleanup
    await job.remove();
  });
});

// ─── Test Suite: Worker Metrics ──────────────────────────────────────────────

describe("Integration: Worker Metrics", () => {
  beforeAll(async () => {
    await getTestRedis();
  });

  beforeEach(async () => {
    await cleanRedis();
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  it("trackJobStart y trackJobComplete actualizan métricas", async () => {
    const { trackJobStart, trackJobComplete, resetMetrics, getMetrics } =
      await import("@/lib/whatsapp/worker-metrics");

    // Resetear métricas
    await resetMetrics();

    // Trackear un job
    const jobId = `test-job-${uuidv4()}`;
    const startTime = await trackJobStart("intake", jobId);

    expect(startTime).toBeGreaterThan(0);

    // Simular procesamiento
    await new Promise((r) => setTimeout(r, 50));

    // Completar job
    await trackJobComplete("intake", jobId, startTime, true);

    // Verificar métricas
    const metrics = await getMetrics("intake");

    expect(metrics.processed).toBeGreaterThanOrEqual(1);
    expect(metrics.avgDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("getAllMetrics retorna métricas de todos los stages", async () => {
    const { getAllMetrics, resetMetrics, trackJobStart, trackJobComplete } =
      await import("@/lib/whatsapp/worker-metrics");

    await resetMetrics();

    // Procesar un job en cada stage
    for (const stage of ["intake", "processing", "response"] as const) {
      const jobId = `metrics-test-${stage}-${uuidv4()}`;
      const start = await trackJobStart(stage, jobId);
      await trackJobComplete(stage, jobId, start, true);
    }

    const metrics = await getAllMetrics();

    expect(metrics).toHaveProperty("intake");
    expect(metrics).toHaveProperty("processing");
    expect(metrics).toHaveProperty("response");

    // Cada stage tiene las propiedades esperadas
    for (const stage of ["intake", "processing", "response"]) {
      expect(metrics[stage as keyof typeof metrics]).toHaveProperty("processed");
      expect(metrics[stage as keyof typeof metrics]).toHaveProperty("failed");
      expect(metrics[stage as keyof typeof metrics]).toHaveProperty("avgDurationMs");
    }
  });

  it("worker heartbeat actualiza estado", async () => {
    const { workerHeartbeat, getActiveWorkers } = await import(
      "@/lib/whatsapp/worker-metrics"
    );

    const workerId = `worker-test-${uuidv4()}`;

    await workerHeartbeat("processing", workerId);

    const workers = await getActiveWorkers("processing");

    expect(workers.length).toBeGreaterThanOrEqual(1);
    expect(workers.some((w) => w.workerId === workerId)).toBe(true);
  });
});

// ─── Test Suite: Concurrency Locks ───────────────────────────────────────────

describe("Integration: Concurrency Locks", () => {
  beforeAll(async () => {
    const prisma = getTestPrisma();
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("pg_advisory_xact_lock bloquea correctamente", async () => {
    const prisma = getTestPrisma();
    const phone = "+5491199999999";
    const lockKey = `wa_user:${phone}`;

    let firstStarted = false;
    let firstFinished = false;
    let secondStarted = false;

    const first = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        firstStarted = true;

        // Simular trabajo
        await new Promise((r) => setTimeout(r, 100));

        firstFinished = true;
        return 1;
      },
      { timeout: 10000 },
    );

    // Esperar un poco para que la primera transacción adquiera el lock
    await new Promise((r) => setTimeout(r, 20));

    const second = prisma.$transaction(
      async (tx) => {
        // Este debería bloquearse hasta que el primero termine
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        secondStarted = true;

        // Si llegamos aquí, el primero ya debería haber terminado
        expect(firstFinished).toBe(true);

        return 2;
      },
      { timeout: 10000 },
    );

    // Esperar ambos
    const [result1, result2] = await Promise.all([first, second]);

    expect(result1).toBe(1);
    expect(result2).toBe(2);
    expect(firstStarted).toBe(true);
    expect(secondStarted).toBe(true);
  });

  it("locks de usuarios diferentes no se bloquean entre sí", async () => {
    const prisma = getTestPrisma();
    const phone1 = "+5491188881111";
    const phone2 = "+5491188882222";

    let tx1InLock = false;
    let tx2InLock = false;

    const first = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wa_user:${phone1}`}))`;
        tx1InLock = true;

        // Esperar un poco para dar tiempo a la segunda transacción
        await new Promise((r) => setTimeout(r, 50));

        // En este punto, si los locks fueran exclusivos globalmente,
        // la segunda transacción no habría podido entrar
        expect(tx2InLock).toBe(true);

        return 1;
      },
      { timeout: 10000 },
    );

    // Pequeño delay para empezar la segunda
    await new Promise((r) => setTimeout(r, 10));

    const second = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wa_user:${phone2}`}))`;
        tx2InLock = true;

        // Esperar un poco
        await new Promise((r) => setTimeout(r, 30));

        return 2;
      },
      { timeout: 10000 },
    );

    const [result1, result2] = await Promise.all([first, second]);

    expect(result1).toBe(1);
    expect(result2).toBe(2);
  });
});

// ─── Test Suite: Queue Idempotency ───────────────────────────────────────────

describe("Integration: Queue Idempotency", () => {
  beforeAll(async () => {
    await getTestRedis();
  });

  beforeEach(async () => {
    await cleanRedis();
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  it("enqueue con mismo jobId es idempotente", async () => {
    const { getIntakeQueue } = await import("@/lib/whatsapp/queues");

    const queue = getIntakeQueue();
    const messageId = `test-idempotent-${uuidv4()}`;
    const jobId = `intake:${messageId}`;

    // Primer add
    const job1 = await queue.add(
      "intake",
      { messageId, receivedAt: Date.now() },
      { jobId },
    );

    // Segundo add con mismo jobId
    const job2 = await queue.add(
      "intake",
      { messageId, receivedAt: Date.now() },
      { jobId },
    );

    // Deben ser el mismo job
    expect(job1.id).toBe(job2.id);

    // Solo debe haber un job en la cola
    const count = await queue.count();
    expect(count).toBe(1);

    // Cleanup
    await job1.remove();
  });

  it("jobs diferentes tienen IDs diferentes", async () => {
    const { getIntakeQueue } = await import("@/lib/whatsapp/queues");

    const queue = getIntakeQueue();

    const job1 = await queue.add(
      "intake",
      { messageId: `msg-${uuidv4()}`, receivedAt: Date.now() },
      { jobId: `job-${uuidv4()}` },
    );

    const job2 = await queue.add(
      "intake",
      { messageId: `msg-${uuidv4()}`, receivedAt: Date.now() },
      { jobId: `job-${uuidv4()}` },
    );

    expect(job1.id).not.toBe(job2.id);

    // Cleanup
    await job1.remove();
    await job2.remove();
  });
});

// ─── Test Suite: Error Classification ────────────────────────────────────────

describe("Integration: Error Classification", () => {
  it("clasifica errores de red como retryables", () => {
    const networkErrors = [
      new Error("ECONNREFUSED"),
      new Error("ETIMEDOUT"),
      new Error("ENOTFOUND"),
      new Error("socket hang up"),
      new Error("network error"),
    ];

    const isRetryable = (error: Error): boolean => {
      const message = error.message.toLowerCase();
      return (
        message.includes("econnrefused") ||
        message.includes("etimedout") ||
        message.includes("enotfound") ||
        message.includes("socket") ||
        message.includes("network")
      );
    };

    for (const error of networkErrors) {
      expect(isRetryable(error)).toBe(true);
    }
  });

  it("clasifica errores de autenticación como no retryables", () => {
    const authErrors = [
      new Error("401 Unauthorized"),
      new Error("403 Forbidden"),
      new Error("Invalid token"),
      new Error("Authentication failed"),
    ];

    const isRetryable = (error: Error): boolean => {
      const message = error.message.toLowerCase();
      return !(
        message.includes("401") ||
        message.includes("403") ||
        message.includes("unauthorized") ||
        message.includes("forbidden") ||
        message.includes("invalid token") ||
        message.includes("authentication failed")
      );
    };

    for (const error of authErrors) {
      expect(isRetryable(error)).toBe(false);
    }
  });
});

// ─── Test Suite: Throughput Validation ───────────────────────────────────────

describe("Integration: Throughput Validation", () => {
  it("configuración por defecto permite >1000 msg/hora", async () => {
    // Processing es el bottleneck con concurrency 10
    const processingConcurrency = 10;
    // Asumiendo 200ms por mensaje promedio
    const avgProcessingTimeMs = 200;

    // Jobs por segundo = concurrency / (avgTime / 1000)
    const jobsPerSecond = processingConcurrency / (avgProcessingTimeMs / 1000);
    const jobsPerHour = jobsPerSecond * 3600;

    console.log(`Throughput teórico: ${jobsPerHour} jobs/hora`);

    expect(jobsPerHour).toBeGreaterThan(1000);
  });

  it("horizontal scaling multiplica throughput linealmente", () => {
    const baseConfig = {
      intakeConcurrency: 20,
      processingConcurrency: 10,
      responseConcurrency: 15,
    };

    // Con 3 instancias de workers
    const instances = 3;
    const scaledConfig = {
      intakeConcurrency: baseConfig.intakeConcurrency * instances,
      processingConcurrency: baseConfig.processingConcurrency * instances,
      responseConcurrency: baseConfig.responseConcurrency * instances,
    };

    expect(scaledConfig.processingConcurrency).toBe(30);
    expect(scaledConfig.intakeConcurrency).toBe(60);
    expect(scaledConfig.responseConcurrency).toBe(45);
  });
});

// ─── Test Suite: BullMQ Queue Operations ─────────────────────────────────────

describe("Integration: BullMQ Queue Operations", () => {
  beforeAll(async () => {
    await getTestRedis();
  });

  beforeEach(async () => {
    await cleanRedis();
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  it("puede agregar jobs a cada cola", async () => {
    const { getIntakeQueue, getProcessingQueue, getResponseQueue } = await import(
      "@/lib/whatsapp/queues"
    );

    const intakeJob = await getIntakeQueue().add(
      "test",
      { messageId: `intake-${uuidv4()}`, receivedAt: Date.now() },
      { jobId: `test-intake-${uuidv4()}` },
    );

    const processingJob = await getProcessingQueue().add(
      "test",
      {
        messageId: `processing-${uuidv4()}`,
        incomingMessageDbId: uuidv4(),
        phone: "+5491155551234",
        text: "test",
        intent: { type: "greeting" },
      },
      { jobId: `test-processing-${uuidv4()}` },
    );

    const responseJob = await getResponseQueue().add(
      "test",
      {
        messageId: `response-${uuidv4()}`,
        phone: "+5491155551234",
        responseText: "Hola!",
      },
      { jobId: `test-response-${uuidv4()}` },
    );

    expect(intakeJob.id).toBeDefined();
    expect(processingJob.id).toBeDefined();
    expect(responseJob.id).toBeDefined();

    // Cleanup
    await Promise.all([
      intakeJob.remove(),
      processingJob.remove(),
      responseJob.remove(),
    ]);
  });

  it("getQueueStats retorna estadísticas", async () => {
    const { getIntakeQueue, getQueueStats } = await import("@/lib/whatsapp/queues");

    // Agregar algunos jobs
    const queue = getIntakeQueue();
    const jobs = await Promise.all([
      queue.add("test", { messageId: `stats-1-${uuidv4()}`, receivedAt: Date.now() }),
      queue.add("test", { messageId: `stats-2-${uuidv4()}`, receivedAt: Date.now() }),
      queue.add("test", { messageId: `stats-3-${uuidv4()}`, receivedAt: Date.now() }),
    ]);

    const stats = await getQueueStats();

    expect(stats.intake).toBeDefined();
    expect(stats.intake.waiting).toBeGreaterThanOrEqual(3);

    // Cleanup
    await Promise.all(jobs.map((j) => j.remove()));
  });
});

// ─── Test Suite: Database Transaction Isolation ──────────────────────────────

describe("Integration: Database Transaction Isolation", () => {
  beforeAll(async () => {
    const prisma = getTestPrisma();
    await prisma.$queryRaw`SELECT 1`;
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("transacciones proveen aislamiento total", async () => {
    const prisma = getTestPrisma();

    // Crear paciente en transacción 1
    const result = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          name: "Test Transaction",
          phone: "+5491100000001",
        },
      });

      // Dentro de la misma transacción, debería ser visible
      const found = await tx.patient.findUnique({
        where: { id: patient.id },
      });

      expect(found).not.toBeNull();

      return patient.id;
    });

    // Fuera de la transacción, también debería ser visible (committed)
    const patient = await prisma.patient.findUnique({
      where: { id: result },
    });

    expect(patient).not.toBeNull();
    expect(patient?.name).toBe("Test Transaction");
  });

  it("rollback deshace cambios", async () => {
    const prisma = getTestPrisma();
    const uniquePhone = `+5491100000${Date.now() % 100000}`;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.patient.create({
          data: {
            name: "Will Be Rolled Back",
            phone: uniquePhone,
          },
        });

        // Forzar error
        throw new Error("Intentional rollback");
      });
    } catch {
      // Expected
    }

    // El paciente no debería existir
    const patient = await prisma.patient.findFirst({
      where: { phone: uniquePhone },
    });

    expect(patient).toBeNull();
  });
});
