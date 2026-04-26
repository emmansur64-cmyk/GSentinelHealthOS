/**
 * Stress Testing Module
 *
 * Sistema de stress testing para validar el comportamiento de la
 * agenda médica bajo carga concurrente.
 *
 * @example
 * ```typescript
 * import { runQuickStressTest, runFullStressTest } from './tests/stress';
 *
 * // Quick test (100 mensajes)
 * const result = await runQuickStressTest({
 *   webhookUrl: 'http://localhost:3000/api/webhook/whatsapp',
 *   webhookToken: 'your_token',
 *   doctorIds: ['doc1', 'doc2'],
 *   doctorNames: { doc1: 'Dr. García', doc2: 'Dra. López' }
 * });
 *
 * // Full test con concurrencia crítica (500 mensajes + 50 usuarios mismo slot)
 * const fullResult = await runFullStressTest({ ... });
 * ```
 */

// ─── Main Runner ─────────────────────────────────────────────────────────────
export {
  StressTestRunner,
  runQuickStressTest,
  runFullStressTest,
  type StressTestConfig,
  type StressTestResult,
} from "./stress-runner";

// ─── Load Generation ─────────────────────────────────────────────────────────
export {
  generateMessages,
  buildWebhookPayload,
  signPayload,
  generateConcurrentSlotConflict,
  type GeneratorConfig,
  type GeneratedMessage,
  type MessageIntent,
  type WebhookPayload,
} from "./load-generator";

// ─── Metrics ─────────────────────────────────────────────────────────────────
export {
  MetricsCollector,
  type MetricsSummary,
  type RequestResult,
  type StressTestThresholds,
  type ThresholdViolation,
  DEFAULT_THRESHOLDS,
} from "./metrics-collector";

// ─── Consistency Validation ──────────────────────────────────────────────────
export {
  ConsistencyValidator,
  validateSingleSlotWinner,
  getAppointmentStats,
  type ConsistencyReport,
  type ConsistencyCheck,
} from "./consistency-validator";

// ─── Critical Concurrency ────────────────────────────────────────────────────
export {
  CriticalConcurrencyRunner,
  runCriticalConcurrencyTest,
  type CriticalConcurrencyConfig,
  type CriticalConcurrencyResult,
} from "./critical-concurrency";

// ─── Failure Detection ───────────────────────────────────────────────────────
export {
  FailureDetector,
  formatFailureReport,
  type FailureCategory,
  type FailureRecord,
  type FailureThresholds,
  type FailureReport,
} from "./failure-detector";

// ─── Test Helpers ────────────────────────────────────────────────────────────
export { assertStressTestPassed } from "./stress.test";
