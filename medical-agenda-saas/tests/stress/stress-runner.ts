/**
 * Main Stress Test Runner
 *
 * Orquestador principal de stress testing para la agenda médica.
 * Ejecuta carga concurrente, recolecta métricas y valida consistencia.
 */
import { PrismaClient } from "@prisma/client";
import {
  generateMessages,
  buildWebhookPayload,
  signPayload,
  type GeneratorConfig,
  type MessageIntent,
  type GeneratedMessage,
} from "./load-generator";
import { MetricsCollector, type MetricsSummary, type RequestResult } from "./metrics-collector";
import { ConsistencyValidator } from "./consistency-validator";
import { FailureDetector, formatFailureReport } from "./failure-detector";
import {
  CriticalConcurrencyRunner,
  type CriticalConcurrencyConfig,
} from "./critical-concurrency";
import crypto from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StressTestConfig {
  /** Nombre del test */
  name: string;

  /** URL del webhook WhatsApp */
  webhookUrl: string;

  /** Token de verificación de webhook */
  webhookToken: string;

  /** Número total de mensajes a enviar */
  totalMessages: number;

  /** Número de mensajes concurrentes */
  concurrency: number;

  /** Distribución de intenciones (opcional) */
  intentDistribution?: Partial<Record<string, number>>;

  /** IDs de doctores disponibles */
  doctorIds: string[];

  /** Nombres de doctores (mapeo por ID) */
  doctorNames: Record<string, string>;

  /** Timeout por request (ms) */
  requestTimeoutMs?: number;

  /** Delay entre batches (ms) */
  batchDelayMs?: number;

  /** Ejecutar test de concurrencia crítica */
  runCriticalConcurrency?: boolean;

  /** Usuarios para concurrencia crítica */
  criticalConcurrencyUsers?: number;
}

export interface StressTestResult {
  name: string;
  success: boolean;
  duration: {
    startTime: Date;
    endTime: Date;
    totalMs: number;
  };
  load: {
    totalMessages: number;
    sentMessages: number;
    successfulMessages: number;
    failedMessages: number;
    throughput: number; // msg/s
  };
  metrics: {
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
    latencyAvg: number;
    errorRate: number;
  };
  validation: {
    consistencyPassed: boolean;
    duplicatesFound: number;
    overlapsFound: number;
    idempotencyViolations: number;
  };
  criticalConcurrency?: {
    passed: boolean;
    appointmentsCreated: number;
    expectedAppointments: number;
  };
  failureReport: {
    passed: boolean;
    thresholdViolations: string[];
    criticalIssues: number;
  };
  observability?: {
    scrapeOk: boolean;
    metricsEndpoint: string;
    requestsTotal?: number;
    queueJobsProcessed?: number;
    queueJobsFailed?: number;
    workerAlerts?: {
      triggerErrorRate: boolean;
      triggerLatency: boolean;
      triggerQueueBacklog: boolean;
      errorRate?: number;
      p95LatencySeconds?: number;
      queueActive?: number;
    };
    scrapeError?: string;
  };
}

// ─── Main Stress Runner ──────────────────────────────────────────────────────

export class StressTestRunner {
  private config: StressTestConfig;
  private prisma: PrismaClient;
  private metrics: MetricsCollector;
  private failures: FailureDetector;
  private startTime!: Date;
  private endTime!: Date;

  constructor(config: StressTestConfig) {
    this.config = {
      requestTimeoutMs: 30000,
      batchDelayMs: 100,
      runCriticalConcurrency: false,
      criticalConcurrencyUsers: 50,
      ...config,
    };
    this.prisma = new PrismaClient();
    this.metrics = new MetricsCollector();
    this.failures = new FailureDetector();
  }

  /**
   * Ejecuta el test de stress completo.
   */
  async run(): Promise<StressTestResult> {
    this.startTime = new Date();
    this.metrics.start();
    let sentMessages = 0;
    let successfulMessages = 0;
    let failedMessages = 0;

    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════════╗");
    console.log("║                     STRESS TEST RUNNER                           ║");
    console.log("╠══════════════════════════════════════════════════════════════════╣");
    console.log(`║  Test: ${this.config.name.padEnd(55)}║`);
    console.log(`║  Total Messages: ${String(this.config.totalMessages).padEnd(46)}║`);
    console.log(`║  Concurrency: ${String(this.config.concurrency).padEnd(49)}║`);
    console.log("╚══════════════════════════════════════════════════════════════════╝");
    console.log("");

    // 1. Generar mensajes
    console.log("[1/5] Generating load...");
    const generatedMessages = generateMessages({
      count: this.config.totalMessages,
      distribution: {
        create: this.config.intentDistribution?.create_appointment ?? 70,
        reschedule: this.config.intentDistribution?.reschedule ?? 15,
        cancel: this.config.intentDistribution?.cancel ?? 10,
        query: this.config.intentDistribution?.query_availability ?? 5,
      },
    });

    // Convertir a payloads de webhook con firmas
    const messages = generatedMessages.map((msg) => {
      const payload = JSON.stringify(buildWebhookPayload(msg));
      return {
        payload,
        signature: signPayload(payload, this.config.webhookToken).replace("sha256=", ""),
        messageId: msg.id,
      };
    });
    console.log(`      Generated ${messages.length} messages`);

    // 2. Enviar mensajes con concurrencia controlada
    console.log("[2/5] Sending messages...");
    const results = await this.sendWithConcurrency(messages);

    for (const result of results) {
      sentMessages++;
      this.failures.recordRequest();

      if (result.success) {
        successfulMessages++;
      } else {
        failedMessages++;
        if (result.httpStatus) {
          this.failures.recordHttpError(
            result.httpStatus,
            result.errorBody || "",
            { messageId: result.messageId },
          );
        } else if (result.error) {
          this.failures.recordConnectionError(
            new Error(result.error),
            { messageId: result.messageId },
          );
        }
      }
    }

    console.log(`      Sent: ${sentMessages}, Success: ${successfulMessages}, Failed: ${failedMessages}`);

    // 3. Esperar procesamiento de cola
    console.log("[3/5] Waiting for queue processing (10s)...");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // 4. Ejecutar test de concurrencia crítica (opcional)
    let criticalResult: StressTestResult["criticalConcurrency"];
    if (this.config.runCriticalConcurrency) {
      console.log("[4/5] Running critical concurrency test...");
      criticalResult = await this.runCriticalConcurrencyTest();
    } else {
      console.log("[4/5] Skipping critical concurrency test");
    }

    // 5. Validar consistencia
    console.log("[5/5] Validating consistency...");
    const validator = new ConsistencyValidator(this.prisma);
    const consistencyReport = await validator.validate();

    // Registrar race conditions si se encontraron duplicados
    if (consistencyReport.summary.overlappingSlots > 0) {
      for (let i = 0; i < consistencyReport.summary.overlappingSlots; i++) {
        this.failures.recordRaceCondition({
          slotDateTime: new Date(),
          doctorId: "unknown",
          appointmentsCreated: 2, // Al menos 2 si hay solapamiento
        });
      }
    }

    this.endTime = new Date();

    // Generar resultado
    this.metrics.end();
    const metricsSummary = this.metrics.getSummary();
    const failureReport = this.failures.generateReport();
    const observability = await this.fetchObservabilitySnapshot();
    const totalMs = this.endTime.getTime() - this.startTime.getTime();

    const result: StressTestResult = {
      name: this.config.name,
      success:
        consistencyReport.valid &&
        failureReport.passed &&
        (criticalResult?.passed ?? true),
      duration: {
        startTime: this.startTime,
        endTime: this.endTime,
        totalMs,
      },
      load: {
        totalMessages: this.config.totalMessages,
        sentMessages,
        successfulMessages,
        failedMessages,
        throughput: sentMessages / (totalMs / 1000),
      },
      metrics: {
        latencyP50: metricsSummary.latency.median,
        latencyP95: metricsSummary.latency.p95,
        latencyP99: metricsSummary.latency.p99,
        latencyAvg: metricsSummary.latency.avg,
        errorRate: metricsSummary.errorRate * 100, // Convert to percentage
      },
      validation: {
        consistencyPassed: consistencyReport.valid,
        duplicatesFound: consistencyReport.summary.duplicateAppointments,
        overlapsFound: consistencyReport.summary.overlappingSlots,
        idempotencyViolations: consistencyReport.summary.idempotencyViolations,
      },
      criticalConcurrency: criticalResult,
      failureReport: {
        passed: failureReport.passed,
        thresholdViolations: failureReport.thresholdViolations,
        criticalIssues: failureReport.criticalFailures.length,
      },
      observability,
    };

    // Imprimir reportes
    console.log(this.formatMetricsSummary(metricsSummary));
    console.log(await validator.generateReport());
    console.log(formatFailureReport(failureReport));

    this.printFinalResult(result);

    return result;
  }

  /**
   * Limpia recursos.
   */
  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private formatMetricsSummary(summary: MetricsSummary): string {
    const lines = [
      "",
      "═══════════════════════════════════════════════════════════════════",
      "                       METRICS SUMMARY",
      "═══════════════════════════════════════════════════════════════════",
      `  Total Requests:    ${summary.totalRequests}`,
      `  Success:           ${summary.successCount} (${(summary.successRate * 100).toFixed(2)}%)`,
      `  Errors:            ${summary.errorCount} (${(summary.errorRate * 100).toFixed(2)}%)`,
      "",
      "  Latency:",
      `    Min:             ${summary.latency.min.toFixed(0)}ms`,
      `    Avg:             ${summary.latency.avg.toFixed(0)}ms`,
      `    Median (P50):    ${summary.latency.median.toFixed(0)}ms`,
      `    P90:             ${summary.latency.p90.toFixed(0)}ms`,
      `    P95:             ${summary.latency.p95.toFixed(0)}ms`,
      `    P99:             ${summary.latency.p99.toFixed(0)}ms`,
      `    Max:             ${summary.latency.max.toFixed(0)}ms`,
      "",
      `  Throughput:        ${summary.throughput.toFixed(1)} req/s`,
      "═══════════════════════════════════════════════════════════════════",
      "",
    ];
    return lines.join("\n");
  }

  private async sendWithConcurrency(
    messages: Array<{ payload: string; signature: string; messageId: string }>,
  ): Promise<
    Array<{
      messageId: string;
      success: boolean;
      httpStatus?: number;
      errorBody?: string;
      error?: string;
    }>
  > {
    const results: Array<{
      messageId: string;
      success: boolean;
      httpStatus?: number;
      errorBody?: string;
      error?: string;
    }> = [];

    // Procesar en batches de tamaño = concurrency
    for (let i = 0; i < messages.length; i += this.config.concurrency) {
      const batch = messages.slice(i, i + this.config.concurrency);

      const batchPromises = batch.map((msg) => this.sendSingleMessage(msg));
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults);

      // Progreso
      const progress = Math.min(i + this.config.concurrency, messages.length);
      const percent = Math.round((progress / messages.length) * 100);
      process.stdout.write(`\r      Progress: ${progress}/${messages.length} (${percent}%)`);

      // Delay entre batches
      if (this.config.batchDelayMs && i + this.config.concurrency < messages.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.batchDelayMs),
        );
      }
    }

    console.log(""); // Nueva línea después del progreso
    return results;
  }

  private async sendSingleMessage(msg: {
    payload: string;
    signature: string;
    messageId: string;
  }): Promise<{
    messageId: string;
    success: boolean;
    httpStatus?: number;
    errorBody?: string;
    error?: string;
  }> {
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.requestTimeoutMs,
      );

      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": `sha256=${msg.signature}`,
        },
        body: msg.payload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();

      if (response.ok) {
        this.metrics.recordRequest({
          messageId: msg.messageId,
          startTime,
          endTime,
          latencyMs: endTime - startTime,
          statusCode: response.status,
          success: true,
        });
        return { messageId: msg.messageId, success: true };
      }

      const errorBody = await response.text();
      this.metrics.recordRequest({
        messageId: msg.messageId,
        startTime,
        endTime,
        latencyMs: endTime - startTime,
        statusCode: response.status,
        success: false,
        error: errorBody.substring(0, 100),
      });

      return {
        messageId: msg.messageId,
        success: false,
        httpStatus: response.status,
        errorBody,
      };
    } catch (error) {
      const endTime = performance.now();
      this.metrics.recordRequest({
        messageId: msg.messageId,
        startTime,
        endTime,
        latencyMs: endTime - startTime,
        statusCode: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        messageId: msg.messageId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async runCriticalConcurrencyTest(): Promise<{
    passed: boolean;
    appointmentsCreated: number;
    expectedAppointments: number;
  }> {
    const targetDateTime = new Date();
    targetDateTime.setDate(targetDateTime.getDate() + 1);
    targetDateTime.setHours(10, 0, 0, 0);

    const doctorId = this.config.doctorIds[0];
    const doctorName = this.config.doctorNames[doctorId] || "Doctor de Prueba";

    const runner = new CriticalConcurrencyRunner(
      {
        concurrentUsers: this.config.criticalConcurrencyUsers || 50,
        targetDateTime,
        doctorId,
        doctorName,
        webhookUrl: this.config.webhookUrl,
        webhookToken: this.config.webhookToken,
      },
      this.prisma,
    );

    const result = await runner.run();

    return {
      passed: result.validation.singleWinner,
      appointmentsCreated: result.metrics.appointmentsCreated,
      expectedAppointments: 1,
    };
  }

  private printFinalResult(result: StressTestResult): void {
    const status = result.success ? "PASSED" : "FAILED";
    const statusColor = result.success ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";

    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════════╗");
    console.log("║                    FINAL TEST RESULT                             ║");
    console.log("╠══════════════════════════════════════════════════════════════════╣");
    console.log(`║  Test: ${result.name.padEnd(55)}║`);
    console.log(`║  Duration: ${(result.duration.totalMs / 1000).toFixed(1)}s`.padEnd(68) + "║");
    console.log(`║  Throughput: ${result.load.throughput.toFixed(1)} msg/s`.padEnd(68) + "║");
    console.log("╠══════════════════════════════════════════════════════════════════╣");
    console.log(`║  Messages: ${result.load.sentMessages} sent, ${result.load.successfulMessages} ok, ${result.load.failedMessages} failed`.padEnd(63) + "║");
    console.log(`║  Error Rate: ${result.metrics.errorRate.toFixed(2)}%`.padEnd(68) + "║");
    console.log(`║  Latency P95: ${result.metrics.latencyP95.toFixed(0)}ms`.padEnd(68) + "║");

    if (result.observability?.scrapeOk) {
      console.log(`║  Prom Requests: ${result.observability.requestsTotal ?? 0}`.padEnd(68) + "║");
      console.log(`║  Queue Jobs OK/Fail: ${(result.observability.queueJobsProcessed ?? 0)}/${(result.observability.queueJobsFailed ?? 0)}`.padEnd(68) + "║");
    }
    console.log("╠══════════════════════════════════════════════════════════════════╣");
    console.log(`║  Consistency: ${result.validation.consistencyPassed ? "PASS" : "FAIL"}`.padEnd(68) + "║");
    console.log(`║  Duplicates: ${result.validation.duplicatesFound}`.padEnd(68) + "║");
    console.log(`║  Overlaps: ${result.validation.overlapsFound}`.padEnd(68) + "║");

    if (result.criticalConcurrency) {
      console.log("╠══════════════════════════════════════════════════════════════════╣");
      console.log(`║  Critical Concurrency: ${result.criticalConcurrency.passed ? "PASS" : "FAIL"}`.padEnd(68) + "║");
      console.log(`║  Appointments Created: ${result.criticalConcurrency.appointmentsCreated} (expected: ${result.criticalConcurrency.expectedAppointments})`.padEnd(63) + "║");
    }

    console.log("╠══════════════════════════════════════════════════════════════════╣");
    console.log(`║  ${statusColor}STATUS: ${status}${reset}`.padEnd(77) + "║");
    console.log("╚══════════════════════════════════════════════════════════════════╝");
    console.log("");
  }

  private async fetchObservabilitySnapshot(): Promise<StressTestResult["observability"]> {
    const metricsEndpoint = this.resolveMetricsEndpoint();

    try {
      const metricsResponse = await fetch(metricsEndpoint, { method: "GET" });
      if (!metricsResponse.ok) {
        return {
          scrapeOk: false,
          metricsEndpoint,
          scrapeError: `metrics endpoint returned ${metricsResponse.status}`,
        };
      }

      const metricsRaw = await metricsResponse.text();
      const requestsTotal = this.extractPromCounter(metricsRaw, "requests_total");
      const queueJobsProcessed = this.extractPromCounter(metricsRaw, "queue_jobs_processed");
      const queueJobsFailed = this.extractPromCounter(metricsRaw, "queue_jobs_failed");

      const adminMetricsUrl = new URL("/api/admin/worker-metrics", this.config.webhookUrl).toString();
      const adminMetricsResponse = await fetch(adminMetricsUrl, { method: "GET" });

      let workerAlerts: NonNullable<StressTestResult["observability"]>["workerAlerts"];
      if (adminMetricsResponse.ok) {
        const body = (await adminMetricsResponse.json()) as {
          data?: {
            alerts?: {
              triggerErrorRate: boolean;
              triggerLatency: boolean;
              triggerQueueBacklog: boolean;
              errorRate?: number;
              p95LatencySeconds?: number;
              queueActive?: number;
            };
          };
        };
        workerAlerts = body.data?.alerts;
      }

      return {
        scrapeOk: true,
        metricsEndpoint,
        requestsTotal,
        queueJobsProcessed,
        queueJobsFailed,
        workerAlerts,
      };
    } catch (error) {
      return {
        scrapeOk: false,
        metricsEndpoint,
        scrapeError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private resolveMetricsEndpoint(): string {
    return new URL("/api/metrics", this.config.webhookUrl).toString();
  }

  private extractPromCounter(metricsRaw: string, metricName: string): number {
    const regex = new RegExp(`^${metricName}(?:\\{[^}]*\\})?\\s+([0-9]+(?:\\.[0-9]+)?)$`, "gm");
    let total = 0;
    for (const match of metricsRaw.matchAll(regex)) {
      total += Number(match[1] ?? 0);
    }
    return total;
  }
}

// ─── Quick Run Functions ─────────────────────────────────────────────────────

/**
 * Ejecuta un stress test rápido con configuración por defecto.
 */
export async function runQuickStressTest(options: {
  webhookUrl: string;
  webhookToken: string;
  doctorIds: string[];
  doctorNames: Record<string, string>;
  messages?: number;
  concurrency?: number;
}): Promise<StressTestResult> {
  const runner = new StressTestRunner({
    name: "Quick Stress Test",
    webhookUrl: options.webhookUrl,
    webhookToken: options.webhookToken,
    doctorIds: options.doctorIds,
    doctorNames: options.doctorNames,
    totalMessages: options.messages || 100,
    concurrency: options.concurrency || 10,
  });

  try {
    return await runner.run();
  } finally {
    await runner.cleanup();
  }
}

/**
 * Ejecuta un stress test completo con concurrencia crítica.
 */
export async function runFullStressTest(options: {
  webhookUrl: string;
  webhookToken: string;
  doctorIds: string[];
  doctorNames: Record<string, string>;
  messages?: number;
  concurrency?: number;
}): Promise<StressTestResult> {
  const runner = new StressTestRunner({
    name: "Full Stress Test with Critical Concurrency",
    webhookUrl: options.webhookUrl,
    webhookToken: options.webhookToken,
    doctorIds: options.doctorIds,
    doctorNames: options.doctorNames,
    totalMessages: options.messages || 500,
    concurrency: options.concurrency || 50,
    runCriticalConcurrency: true,
    criticalConcurrencyUsers: 50,
  });

  try {
    return await runner.run();
  } finally {
    await runner.cleanup();
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  const config = {
    webhookUrl: process.env.WEBHOOK_URL || "http://localhost:3000/api/webhook/whatsapp",
    webhookToken: process.env.WEBHOOK_TOKEN || "test_token",
    doctorIds: (process.env.DOCTOR_IDS || "doc1,doc2").split(","),
    doctorNames: JSON.parse(
      process.env.DOCTOR_NAMES || '{"doc1":"Dr. García","doc2":"Dra. López"}',
    ),
    messages: parseInt(process.env.STRESS_MESSAGES || "100", 10),
    concurrency: parseInt(process.env.STRESS_CONCURRENCY || "10", 10),
  };

  const runFull = args.includes("--full");

  console.log("Starting stress test...");
  console.log(`  Mode: ${runFull ? "Full" : "Quick"}`);
  console.log(`  Webhook: ${config.webhookUrl}`);
  console.log(`  Messages: ${config.messages}`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log("");

  const testFn = runFull ? runFullStressTest : runQuickStressTest;

  testFn(config)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Stress test failed:", error);
      process.exit(1);
    });
}
