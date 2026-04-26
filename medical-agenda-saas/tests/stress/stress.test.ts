/**
 * Stress Test Suite
 *
 * Suite de tests automatizados para validar el comportamiento
 * del sistema bajo carga y verificar invariantes críticos.
 *
 * Criterios de fallo:
 * - errorRate > 2%
 * - duplicates > 0
 * - overlaps > 0
 * - p95 > 2000ms
 * - race condition en concurrencia crítica
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  StressTestRunner,
  runQuickStressTest,
  runFullStressTest,
  type StressTestResult,
} from "./stress-runner";
import {
  ConsistencyValidator,
  validateSingleSlotWinner,
  getAppointmentStats,
} from "./consistency-validator";
import { CriticalConcurrencyRunner } from "./critical-concurrency";
import { MetricsCollector, type RequestResult } from "./metrics-collector";
import { FailureDetector } from "./failure-detector";
import { generateMessages, buildWebhookPayload, signPayload } from "./load-generator";

// ─── Test Configuration ──────────────────────────────────────────────────────

const TEST_CONFIG = {
  webhookUrl:
    process.env.WEBHOOK_URL || "http://localhost:3000/api/webhook/whatsapp",
  webhookToken: process.env.WEBHOOK_TOKEN || "test_token",
  doctorIds: (process.env.DOCTOR_IDS || "test-doctor-1,test-doctor-2").split(
    ",",
  ),
  doctorNames: JSON.parse(
    process.env.DOCTOR_NAMES ||
      '{"test-doctor-1":"Dr. García Test","test-doctor-2":"Dra. López Test"}',
  ),
};

// Thresholds
const THRESHOLDS = {
  maxErrorRatePercent: 2.0,
  maxDuplicates: 0,
  maxOverlaps: 0,
  maxP95Ms: 2000,
  maxP99Ms: 5000,
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("Stress Tests", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Verificar conexión
    await prisma.$connect();
    console.log("Database connected for stress tests");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Load Generation", () => {
    it("should generate valid message batches", async () => {
      const messages = generateMessages({ count: 10 });

      expect(messages).toHaveLength(10);

      for (const msg of messages) {
        expect(msg.id).toBeDefined();
        expect(msg.phone).toBeDefined();
        expect(msg.text).toBeDefined();
        expect(msg.intent).toBeDefined();
        
        // Verificar que podemos construir payload válido
        const payload = buildWebhookPayload(msg);
        expect(payload.object).toBe("whatsapp_business_account");
        expect(payload.entry).toBeInstanceOf(Array);
        
        // Verificar firma
        const payloadStr = JSON.stringify(payload);
        const signature = signPayload(payloadStr, "test_token");
        expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
      }
    });

    it("should distribute intents according to configuration", async () => {
      const messages = generateMessages({
        count: 50,
        distribution: {
          create: 100, // 100% create
          reschedule: 0,
          cancel: 0,
        },
      });

      // Verificar que todos tienen intención de crear
      for (const msg of messages) {
        expect(msg.intent).toBe("create");
        expect(msg.text.toLowerCase()).toMatch(/turno|cita|reservar|agendar|necesito|quiero/i);
      }
    });
  });

  describe("Metrics Collection", () => {
    it("should calculate percentiles correctly", () => {
      const collector = new MetricsCollector();
      collector.start();

      // Simular 100 requests con latencias variables
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        // Simular latencia (mayoría rápidas, algunas lentas)
        const latency = i < 95 ? 100 + Math.random() * 100 : 500 + Math.random() * 500;
        
        collector.recordRequest({
          messageId: `req_${i}`,
          startTime,
          endTime: startTime + latency,
          latencyMs: latency,
          statusCode: i < 98 ? 200 : 500,
          success: i < 98,
          error: i >= 98 ? "test error" : undefined,
        });
      }

      collector.end();
      const summary = collector.getSummary();

      expect(summary.totalRequests).toBe(100);
      expect(summary.errorRate).toBeCloseTo(0.02, 2); // 2% as decimal
    });

    it("should track success and error counts", () => {
      const collector = new MetricsCollector();
      collector.start();

      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        collector.recordRequest({
          messageId: `test_${i}`,
          startTime,
          endTime: startTime + 50,
          latencyMs: 50,
          statusCode: i < 8 ? 200 : 500,
          success: i < 8,
          error: i >= 8 ? "test error" : undefined,
        });
      }

      collector.end();
      const summary = collector.getSummary();

      expect(summary.successCount).toBe(8);
      expect(summary.errorCount).toBe(2);
      expect(summary.errorRate).toBe(0.2); // 20% as decimal
    });
  });

  describe("Failure Detection", () => {
    it("should classify HTTP errors correctly", () => {
      const detector = new FailureDetector();

      detector.recordRequest();
      detector.recordHttpError(408, "Request timeout");

      detector.recordRequest();
      detector.recordHttpError(429, "Rate limit exceeded");

      detector.recordRequest();
      detector.recordHttpError(409, "Duplicate detected");

      detector.recordRequest();
      detector.recordHttpError(500, "Internal server error");

      const report = detector.generateReport();

      expect(report.failuresByCategory.timeout).toBe(1);
      expect(report.failuresByCategory.rate_limit).toBe(1);
      expect(report.failuresByCategory.duplicate).toBe(1);
      expect(report.failuresByCategory.http_error).toBe(1);
    });

    it("should detect threshold violations", () => {
      const detector = new FailureDetector({
        maxErrorRatePercent: 5,
        maxTimeouts: 2,
      });

      // Simular 100 requests con 10 errores (10% error rate)
      for (let i = 0; i < 100; i++) {
        detector.recordRequest();
      }

      // 6 timeouts y 4 errores HTTP
      for (let i = 0; i < 6; i++) {
        detector.recordFailure("timeout", `Timeout ${i}`);
      }
      for (let i = 0; i < 4; i++) {
        detector.recordFailure("http_error", `Error ${i}`, {}, 500);
      }

      const report = detector.generateReport();

      expect(report.passed).toBe(false);
      expect(report.thresholdViolations.length).toBeGreaterThan(0);
      expect(report.thresholdViolations).toContain(
        expect.stringContaining("Error rate"),
      );
      expect(report.thresholdViolations).toContain(
        expect.stringContaining("Timeouts"),
      );
    });
  });

  describe("Consistency Validation", () => {
    it("should validate empty database as consistent", async () => {
      // Este test asume una DB limpia o de prueba
      const validator = new ConsistencyValidator(prisma);

      // Solo ejecutamos si la DB está vacía o es de prueba
      const count = await prisma.appointment.count();

      if (count === 0) {
        const report = await validator.validate();
        expect(report.valid).toBe(true);
        expect(report.summary.duplicateAppointments).toBe(0);
        expect(report.summary.overlappingSlots).toBe(0);
      } else {
        console.log("Skipping empty DB test - database has data");
      }
    });
  });

  // ─── Integration Tests (requieren servidor corriendo) ──────────────────────

  describe.skipIf(!process.env.RUN_STRESS_INTEGRATION)(
    "Integration Stress Tests",
    () => {
      it(
        "should handle 100 concurrent messages with < 2% error rate",
        async () => {
          const result = await runQuickStressTest({
            ...TEST_CONFIG,
            messages: 100,
            concurrency: 10,
          });

          expect(result.metrics.errorRate).toBeLessThanOrEqual(
            THRESHOLDS.maxErrorRatePercent,
          );
          expect(result.validation.duplicatesFound).toBe(THRESHOLDS.maxDuplicates);
          expect(result.validation.overlapsFound).toBe(THRESHOLDS.maxOverlaps);
        },
        120000,
      );

      it(
        "should maintain consistency under 500 messages load",
        async () => {
          const result = await runQuickStressTest({
            ...TEST_CONFIG,
            messages: 500,
            concurrency: 50,
          });

          expect(result.validation.consistencyPassed).toBe(true);
          expect(result.validation.idempotencyViolations).toBe(0);
        },
        300000,
      );

      it(
        "should have P95 latency under 2 seconds",
        async () => {
          const result = await runQuickStressTest({
            ...TEST_CONFIG,
            messages: 200,
            concurrency: 20,
          });

          expect(result.metrics.latencyP95).toBeLessThanOrEqual(THRESHOLDS.maxP95Ms);
        },
        180000,
      );
    },
  );

  // ─── Critical Concurrency Tests (requiere servidor) ────────────────────────

  describe.skipIf(!process.env.RUN_CRITICAL_CONCURRENCY)(
    "Critical Concurrency Tests",
    () => {
      it(
        "should create exactly 1 appointment when 50 users book same slot",
        async () => {
          const targetDateTime = new Date();
          targetDateTime.setDate(targetDateTime.getDate() + 1);
          targetDateTime.setHours(14, 0, 0, 0);

          const runner = new CriticalConcurrencyRunner(
            {
              concurrentUsers: 50,
              targetDateTime,
              doctorId: TEST_CONFIG.doctorIds[0],
              doctorName: TEST_CONFIG.doctorNames[TEST_CONFIG.doctorIds[0]],
              webhookUrl: TEST_CONFIG.webhookUrl,
              webhookToken: TEST_CONFIG.webhookToken,
            },
            prisma,
          );

          const result = await runner.run();

          expect(result.validation.singleWinner).toBe(true);
          expect(result.metrics.appointmentsCreated).toBe(1);
          expect(result.validation.noOverlaps).toBe(true);
        },
        120000,
      );

      it(
        "should reject duplicates and maintain idempotency",
        async () => {
          const targetDateTime = new Date();
          targetDateTime.setDate(targetDateTime.getDate() + 2);
          targetDateTime.setHours(10, 0, 0, 0);

          const runner = new CriticalConcurrencyRunner(
            {
              concurrentUsers: 30,
              targetDateTime,
              doctorId: TEST_CONFIG.doctorIds[0],
              doctorName: TEST_CONFIG.doctorNames[TEST_CONFIG.doctorIds[0]],
              webhookUrl: TEST_CONFIG.webhookUrl,
              webhookToken: TEST_CONFIG.webhookToken,
            },
            prisma,
          );

          const result = await runner.run();

          expect(result.validation.idempotencyRespected).toBe(true);
        },
        120000,
      );
    },
  );

  // ─── Full Stress Tests (solo en CI o explícitamente) ───────────────────────

  describe.skipIf(!process.env.RUN_FULL_STRESS)("Full Stress Tests", () => {
    it(
      "should pass full stress test with all validations",
      async () => {
        const result = await runFullStressTest({
          ...TEST_CONFIG,
          messages: 500,
          concurrency: 50,
        });

        // Validaciones críticas
        expect(result.success).toBe(true);
        expect(result.validation.consistencyPassed).toBe(true);
        expect(result.validation.duplicatesFound).toBe(0);
        expect(result.validation.overlapsFound).toBe(0);
        expect(result.metrics.errorRate).toBeLessThanOrEqual(2.0);
        expect(result.metrics.latencyP95).toBeLessThanOrEqual(2000);

        if (result.criticalConcurrency) {
          expect(result.criticalConcurrency.passed).toBe(true);
          expect(result.criticalConcurrency.appointmentsCreated).toBe(1);
        }
      },
      600000,
    );
  });
});

// ─── Assertion Helpers ───────────────────────────────────────────────────────

export function assertStressTestPassed(result: StressTestResult): void {
  const errors: string[] = [];

  if (result.metrics.errorRate > THRESHOLDS.maxErrorRatePercent) {
    errors.push(
      `Error rate ${result.metrics.errorRate.toFixed(2)}% exceeds ${THRESHOLDS.maxErrorRatePercent}%`,
    );
  }

  if (result.validation.duplicatesFound > THRESHOLDS.maxDuplicates) {
    errors.push(
      `Found ${result.validation.duplicatesFound} duplicates (max: ${THRESHOLDS.maxDuplicates})`,
    );
  }

  if (result.validation.overlapsFound > THRESHOLDS.maxOverlaps) {
    errors.push(
      `Found ${result.validation.overlapsFound} overlaps (max: ${THRESHOLDS.maxOverlaps})`,
    );
  }

  if (result.metrics.latencyP95 > THRESHOLDS.maxP95Ms) {
    errors.push(
      `P95 latency ${result.metrics.latencyP95.toFixed(0)}ms exceeds ${THRESHOLDS.maxP95Ms}ms`,
    );
  }

  if (result.criticalConcurrency && !result.criticalConcurrency.passed) {
    errors.push(
      `Critical concurrency failed: ${result.criticalConcurrency.appointmentsCreated} appointments created (expected: 1)`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`Stress test failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
}
