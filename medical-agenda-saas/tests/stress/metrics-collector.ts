/**
 * Metrics Collector for Stress Testing
 *
 * Recolecta y analiza métricas de rendimiento durante los tests de carga.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RequestResult {
  messageId: string;
  startTime: number;
  endTime: number;
  latencyMs: number;
  statusCode: number;
  success: boolean;
  error?: string;
  intent?: string;
}

export interface MetricsSummary {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  errorRate: number;
  totalDurationMs: number;
  throughput: number; // requests per second
  latency: {
    min: number;
    max: number;
    avg: number;
    median: number;
    p90: number;
    p95: number;
    p99: number;
  };
  statusCodes: Record<number, number>;
  errorsByType: Record<string, number>;
  duplicatesDetected: number;
  timeoutCount: number;
}

export interface StressTestThresholds {
  maxErrorRate: number;        // e.g., 0.02 = 2%
  maxDuplicates: number;       // e.g., 0
  maxP95LatencyMs: number;     // e.g., 2000
  minSuccessRate: number;      // e.g., 0.98 = 98%
}

export interface ThresholdViolation {
  metric: string;
  expected: string;
  actual: string;
  passed: boolean;
}

// ─── Default Thresholds ──────────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS: StressTestThresholds = {
  maxErrorRate: 0.02,
  maxDuplicates: 0,
  maxP95LatencyMs: 2000,
  minSuccessRate: 0.98,
};

// ─── Metrics Collector Class ─────────────────────────────────────────────────

export class MetricsCollector {
  private results: RequestResult[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private duplicatesDetected = 0;

  /**
   * Inicia la recolección de métricas.
   */
  start(): void {
    this.results = [];
    this.startTime = performance.now();
    this.duplicatesDetected = 0;
  }

  /**
   * Finaliza la recolección.
   */
  end(): void {
    this.endTime = performance.now();
  }

  /**
   * Registra el resultado de un request.
   */
  recordRequest(result: RequestResult): void {
    this.results.push(result);
  }

  /**
   * Incrementa contador de duplicados detectados.
   */
  recordDuplicate(): void {
    this.duplicatesDetected++;
  }

  /**
   * Obtiene todos los resultados individuales.
   */
  getResults(): RequestResult[] {
    return [...this.results];
  }

  /**
   * Calcula el resumen de métricas.
   */
  getSummary(): MetricsSummary {
    const totalDurationMs = this.endTime - this.startTime;
    const total = this.results.length;

    if (total === 0) {
      return this.createEmptySummary();
    }

    const successes = this.results.filter((r) => r.success);
    const errors = this.results.filter((r) => !r.success);
    const timeouts = this.results.filter((r) => r.error?.includes("timeout"));

    const latencies = this.results.map((r) => r.latencyMs).sort((a, b) => a - b);

    const statusCodes: Record<number, number> = {};
    const errorsByType: Record<string, number> = {};

    for (const result of this.results) {
      statusCodes[result.statusCode] = (statusCodes[result.statusCode] || 0) + 1;
      if (result.error) {
        const errorKey = this.normalizeErrorKey(result.error);
        errorsByType[errorKey] = (errorsByType[errorKey] || 0) + 1;
      }
    }

    return {
      totalRequests: total,
      successCount: successes.length,
      errorCount: errors.length,
      successRate: successes.length / total,
      errorRate: errors.length / total,
      totalDurationMs,
      throughput: (total / totalDurationMs) * 1000, // per second
      latency: {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        median: this.percentile(latencies, 50),
        p90: this.percentile(latencies, 90),
        p95: this.percentile(latencies, 95),
        p99: this.percentile(latencies, 99),
      },
      statusCodes,
      errorsByType,
      duplicatesDetected: this.duplicatesDetected,
      timeoutCount: timeouts.length,
    };
  }

  /**
   * Valida métricas contra umbrales.
   */
  validateThresholds(
    thresholds: StressTestThresholds = DEFAULT_THRESHOLDS,
  ): { passed: boolean; violations: ThresholdViolation[] } {
    const summary = this.getSummary();
    const violations: ThresholdViolation[] = [];

    // Error rate
    violations.push({
      metric: "errorRate",
      expected: `<= ${(thresholds.maxErrorRate * 100).toFixed(1)}%`,
      actual: `${(summary.errorRate * 100).toFixed(2)}%`,
      passed: summary.errorRate <= thresholds.maxErrorRate,
    });

    // Duplicates
    violations.push({
      metric: "duplicates",
      expected: `<= ${thresholds.maxDuplicates}`,
      actual: `${summary.duplicatesDetected}`,
      passed: summary.duplicatesDetected <= thresholds.maxDuplicates,
    });

    // P95 latency
    violations.push({
      metric: "p95Latency",
      expected: `<= ${thresholds.maxP95LatencyMs}ms`,
      actual: `${summary.latency.p95.toFixed(0)}ms`,
      passed: summary.latency.p95 <= thresholds.maxP95LatencyMs,
    });

    // Success rate
    violations.push({
      metric: "successRate",
      expected: `>= ${(thresholds.minSuccessRate * 100).toFixed(1)}%`,
      actual: `${(summary.successRate * 100).toFixed(2)}%`,
      passed: summary.successRate >= thresholds.minSuccessRate,
    });

    return {
      passed: violations.every((v) => v.passed),
      violations,
    };
  }

  /**
   * Genera reporte en formato texto.
   */
  generateReport(thresholds?: StressTestThresholds): string {
    const summary = this.getSummary();
    const validation = this.validateThresholds(thresholds);

    const lines: string[] = [
      "",
      "═══════════════════════════════════════════════════════════════════",
      "                    STRESS TEST REPORT",
      "═══════════════════════════════════════════════════════════════════",
      "",
      "SUMMARY",
      "───────────────────────────────────────────────────────────────────",
      `  Total Requests:     ${summary.totalRequests}`,
      `  Total Duration:     ${(summary.totalDurationMs / 1000).toFixed(2)}s`,
      `  Throughput:         ${summary.throughput.toFixed(2)} req/s`,
      "",
      `  Success Count:      ${summary.successCount}`,
      `  Error Count:        ${summary.errorCount}`,
      `  Success Rate:       ${(summary.successRate * 100).toFixed(2)}%`,
      `  Error Rate:         ${(summary.errorRate * 100).toFixed(2)}%`,
      "",
      "LATENCY",
      "───────────────────────────────────────────────────────────────────",
      `  Min:                ${summary.latency.min.toFixed(0)}ms`,
      `  Max:                ${summary.latency.max.toFixed(0)}ms`,
      `  Avg:                ${summary.latency.avg.toFixed(0)}ms`,
      `  Median (p50):       ${summary.latency.median.toFixed(0)}ms`,
      `  p90:                ${summary.latency.p90.toFixed(0)}ms`,
      `  p95:                ${summary.latency.p95.toFixed(0)}ms`,
      `  p99:                ${summary.latency.p99.toFixed(0)}ms`,
      "",
      "STATUS CODES",
      "───────────────────────────────────────────────────────────────────",
    ];

    for (const [code, count] of Object.entries(summary.statusCodes)) {
      lines.push(`  ${code}:                 ${count}`);
    }

    if (Object.keys(summary.errorsByType).length > 0) {
      lines.push(
        "",
        "ERRORS BY TYPE",
        "───────────────────────────────────────────────────────────────────",
      );
      for (const [type, count] of Object.entries(summary.errorsByType)) {
        lines.push(`  ${type}: ${count}`);
      }
    }

    lines.push(
      "",
      "ADDITIONAL METRICS",
      "───────────────────────────────────────────────────────────────────",
      `  Duplicates Detected: ${summary.duplicatesDetected}`,
      `  Timeouts:            ${summary.timeoutCount}`,
      "",
      "THRESHOLD VALIDATION",
      "───────────────────────────────────────────────────────────────────",
    );

    for (const v of validation.violations) {
      const status = v.passed ? "PASS" : "FAIL";
      lines.push(`  [${status}] ${v.metric}: ${v.actual} (expected ${v.expected})`);
    }

    lines.push(
      "",
      "═══════════════════════════════════════════════════════════════════",
      `  OVERALL RESULT: ${validation.passed ? "PASSED" : "FAILED"}`,
      "═══════════════════════════════════════════════════════════════════",
      "",
    );

    return lines.join("\n");
  }

  /**
   * Genera reporte JSON.
   */
  toJSON(): object {
    const summary = this.getSummary();
    const validation = this.validateThresholds();

    return {
      summary,
      validation,
      results: this.results,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private normalizeErrorKey(error: string): string {
    if (error.includes("timeout")) return "TIMEOUT";
    if (error.includes("ECONNREFUSED")) return "CONNECTION_REFUSED";
    if (error.includes("429")) return "RATE_LIMITED";
    if (error.includes("500")) return "SERVER_ERROR";
    if (error.includes("503")) return "SERVICE_UNAVAILABLE";
    return error.substring(0, 50);
  }

  private createEmptySummary(): MetricsSummary {
    return {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      successRate: 0,
      errorRate: 0,
      totalDurationMs: 0,
      throughput: 0,
      latency: {
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      },
      statusCodes: {},
      errorsByType: {},
      duplicatesDetected: 0,
      timeoutCount: 0,
    };
  }
}

// ─── Singleton for Global Collection ─────────────────────────────────────────

let globalCollector: MetricsCollector | null = null;

export function getGlobalCollector(): MetricsCollector {
  if (!globalCollector) {
    globalCollector = new MetricsCollector();
  }
  return globalCollector;
}

export function resetGlobalCollector(): void {
  globalCollector = new MetricsCollector();
}
