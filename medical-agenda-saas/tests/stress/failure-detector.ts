/**
 * Failure Detector Module
 *
 * Detecta y clasifica fallos durante el stress testing.
 * Genera reportes detallados de problemas encontrados.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type FailureCategory =
  | "timeout"
  | "http_error"
  | "validation_error"
  | "rate_limit"
  | "connection_error"
  | "duplicate"
  | "race_condition"
  | "data_corruption"
  | "unknown";

export interface FailureRecord {
  id: string;
  timestamp: Date;
  category: FailureCategory;
  message: string;
  context: Record<string, unknown>;
  httpStatus?: number;
  stack?: string;
}

export interface FailureThresholds {
  /** Porcentaje máximo de errores permitido */
  maxErrorRatePercent: number;

  /** Número máximo de timeouts */
  maxTimeouts: number;

  /** Número máximo de errores de conexión */
  maxConnectionErrors: number;

  /** Número máximo de duplicados detectados (debería ser 0) */
  maxDuplicates: number;

  /** Número máximo de race conditions (debería ser 0) */
  maxRaceConditions: number;
}

export interface FailureReport {
  passed: boolean;
  totalRequests: number;
  totalFailures: number;
  errorRate: number;
  failuresByCategory: Record<FailureCategory, number>;
  criticalFailures: FailureRecord[];
  thresholdViolations: string[];
  recommendations: string[];
}

// ─── Default Thresholds ──────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: FailureThresholds = {
  maxErrorRatePercent: 2.0,
  maxTimeouts: 5,
  maxConnectionErrors: 3,
  maxDuplicates: 0,
  maxRaceConditions: 0,
};

// ─── Failure Detector Class ──────────────────────────────────────────────────

export class FailureDetector {
  private failures: FailureRecord[] = [];
  private totalRequests = 0;
  private thresholds: FailureThresholds;

  constructor(thresholds: Partial<FailureThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Registra una petición (para calcular tasa de error).
   */
  recordRequest(): void {
    this.totalRequests++;
  }

  /**
   * Registra un fallo.
   */
  recordFailure(
    category: FailureCategory,
    message: string,
    context: Record<string, unknown> = {},
    httpStatus?: number,
    stack?: string,
  ): void {
    const failure: FailureRecord = {
      id: `failure_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
      category,
      message,
      context,
      httpStatus,
      stack,
    };

    this.failures.push(failure);
  }

  /**
   * Clasificar error HTTP y registrarlo.
   */
  recordHttpError(
    status: number,
    body: string,
    context: Record<string, unknown> = {},
  ): void {
    let category: FailureCategory = "http_error";
    let message = `HTTP ${status}`;

    if (status === 408 || status === 504 || body.includes("timeout")) {
      category = "timeout";
      message = `Request timeout (HTTP ${status})`;
    } else if (status === 429 || body.includes("rate_limit")) {
      category = "rate_limit";
      message = `Rate limited (HTTP ${status})`;
    } else if (status === 409 && body.includes("duplicate")) {
      category = "duplicate";
      message = `Duplicate detected (HTTP ${status})`;
    } else if (status === 422) {
      category = "validation_error";
      message = `Validation error (HTTP ${status}): ${body.substring(0, 100)}`;
    } else if (status >= 500) {
      message = `Server error (HTTP ${status}): ${body.substring(0, 100)}`;
    }

    this.recordFailure(category, message, context, status);
  }

  /**
   * Registrar error de conexión.
   */
  recordConnectionError(error: Error, context: Record<string, unknown> = {}): void {
    const isTimeout =
      error.message.includes("timeout") ||
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("ESOCKETTIMEDOUT");

    const category: FailureCategory = isTimeout ? "timeout" : "connection_error";
    const message = `Connection error: ${error.message}`;

    this.recordFailure(category, message, context, undefined, error.stack);
  }

  /**
   * Registrar race condition detectada.
   */
  recordRaceCondition(details: {
    slotDateTime: Date;
    doctorId: string;
    appointmentsCreated: number;
  }): void {
    this.recordFailure(
      "race_condition",
      `Race condition: ${details.appointmentsCreated} appointments created for same slot`,
      {
        slotDateTime: details.slotDateTime.toISOString(),
        doctorId: details.doctorId,
        appointmentsCreated: details.appointmentsCreated,
      },
    );
  }

  /**
   * Registrar corrupción de datos.
   */
  recordDataCorruption(details: string, context: Record<string, unknown> = {}): void {
    this.recordFailure("data_corruption", `Data corruption: ${details}`, context);
  }

  /**
   * Genera el reporte de fallos.
   */
  generateReport(): FailureReport {
    const failuresByCategory = this.countByCategory();
    const errorRate =
      this.totalRequests > 0
        ? (this.failures.length / this.totalRequests) * 100
        : 0;

    const thresholdViolations = this.checkThresholds(failuresByCategory, errorRate);
    const criticalFailures = this.getCriticalFailures();
    const recommendations = this.generateRecommendations(failuresByCategory);

    return {
      passed: thresholdViolations.length === 0,
      totalRequests: this.totalRequests,
      totalFailures: this.failures.length,
      errorRate,
      failuresByCategory,
      criticalFailures,
      thresholdViolations,
      recommendations,
    };
  }

  /**
   * Reinicia el detector.
   */
  reset(): void {
    this.failures = [];
    this.totalRequests = 0;
  }

  /**
   * Obtiene todos los fallos.
   */
  getFailures(): FailureRecord[] {
    return [...this.failures];
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private countByCategory(): Record<FailureCategory, number> {
    const counts: Record<FailureCategory, number> = {
      timeout: 0,
      http_error: 0,
      validation_error: 0,
      rate_limit: 0,
      connection_error: 0,
      duplicate: 0,
      race_condition: 0,
      data_corruption: 0,
      unknown: 0,
    };

    for (const failure of this.failures) {
      counts[failure.category]++;
    }

    return counts;
  }

  private checkThresholds(
    byCategory: Record<FailureCategory, number>,
    errorRate: number,
  ): string[] {
    const violations: string[] = [];

    if (errorRate > this.thresholds.maxErrorRatePercent) {
      violations.push(
        `Error rate ${errorRate.toFixed(2)}% exceeds threshold ${this.thresholds.maxErrorRatePercent}%`,
      );
    }

    if (byCategory.timeout > this.thresholds.maxTimeouts) {
      violations.push(
        `Timeouts (${byCategory.timeout}) exceed threshold (${this.thresholds.maxTimeouts})`,
      );
    }

    if (byCategory.connection_error > this.thresholds.maxConnectionErrors) {
      violations.push(
        `Connection errors (${byCategory.connection_error}) exceed threshold (${this.thresholds.maxConnectionErrors})`,
      );
    }

    if (byCategory.duplicate > this.thresholds.maxDuplicates) {
      violations.push(
        `Duplicates (${byCategory.duplicate}) exceed threshold (${this.thresholds.maxDuplicates})`,
      );
    }

    if (byCategory.race_condition > this.thresholds.maxRaceConditions) {
      violations.push(
        `Race conditions (${byCategory.race_condition}) exceed threshold (${this.thresholds.maxRaceConditions})`,
      );
    }

    if (byCategory.data_corruption > 0) {
      violations.push(`Data corruption detected (${byCategory.data_corruption} instances)`);
    }

    return violations;
  }

  private getCriticalFailures(): FailureRecord[] {
    const criticalCategories: FailureCategory[] = [
      "race_condition",
      "data_corruption",
      "duplicate",
    ];

    return this.failures.filter((f) => criticalCategories.includes(f.category));
  }

  private generateRecommendations(
    byCategory: Record<FailureCategory, number>,
  ): string[] {
    const recommendations: string[] = [];

    if (byCategory.timeout > 0) {
      recommendations.push(
        "Consider increasing timeout values or optimizing slow endpoints",
      );
    }

    if (byCategory.rate_limit > 0) {
      recommendations.push(
        "Implement backoff/retry logic or increase rate limits for testing",
      );
    }

    if (byCategory.race_condition > 0) {
      recommendations.push(
        "CRITICAL: Implement pessimistic locking or SERIALIZABLE isolation for slot booking",
      );
    }

    if (byCategory.duplicate > 0) {
      recommendations.push(
        "CRITICAL: Review idempotency logic - duplicates should not occur",
      );
    }

    if (byCategory.connection_error > 0) {
      recommendations.push(
        "Check infrastructure stability - connection errors may indicate resource exhaustion",
      );
    }

    if (byCategory.data_corruption > 0) {
      recommendations.push(
        "CRITICAL: Review transaction boundaries and data validation logic",
      );
    }

    return recommendations;
  }
}

// ─── Report Formatter ────────────────────────────────────────────────────────

export function formatFailureReport(report: FailureReport): string {
  const lines: string[] = [
    "",
    "══════════════════════════════════════════════════════════════════════",
    "                    FAILURE DETECTION REPORT",
    "══════════════════════════════════════════════════════════════════════",
    "",
    "SUMMARY",
    "──────────────────────────────────────────────────────────────────────",
    `  Total Requests:    ${report.totalRequests}`,
    `  Total Failures:    ${report.totalFailures}`,
    `  Error Rate:        ${report.errorRate.toFixed(2)}%`,
    "",
    "FAILURES BY CATEGORY",
    "──────────────────────────────────────────────────────────────────────",
  ];

  for (const [category, count] of Object.entries(report.failuresByCategory)) {
    if (count > 0) {
      lines.push(`  ${category.padEnd(20)} ${count}`);
    }
  }

  if (report.thresholdViolations.length > 0) {
    lines.push(
      "",
      "THRESHOLD VIOLATIONS",
      "──────────────────────────────────────────────────────────────────────",
    );
    for (const violation of report.thresholdViolations) {
      lines.push(`  [FAIL] ${violation}`);
    }
  }

  if (report.criticalFailures.length > 0) {
    lines.push(
      "",
      "CRITICAL FAILURES (first 5)",
      "──────────────────────────────────────────────────────────────────────",
    );
    for (const failure of report.criticalFailures.slice(0, 5)) {
      lines.push(`  [${failure.category.toUpperCase()}] ${failure.message}`);
      if (Object.keys(failure.context).length > 0) {
        lines.push(`    Context: ${JSON.stringify(failure.context)}`);
      }
    }
  }

  if (report.recommendations.length > 0) {
    lines.push(
      "",
      "RECOMMENDATIONS",
      "──────────────────────────────────────────────────────────────────────",
    );
    for (const rec of report.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }

  lines.push(
    "",
    "══════════════════════════════════════════════════════════════════════",
    `  RESULT: ${report.passed ? "PASSED" : "FAILED"}`,
    "══════════════════════════════════════════════════════════════════════",
    "",
  );

  return lines.join("\n");
}
