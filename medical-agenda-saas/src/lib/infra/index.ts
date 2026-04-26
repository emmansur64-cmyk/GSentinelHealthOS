/**
 * Infrastructure Module
 *
 * Módulo centralizado para gestión de infraestructura en tests:
 * - Health checks de Redis y PostgreSQL
 * - Auto-bootstrap opcional en desarrollo
 * - Validación de configuración
 * - Aislamiento de datos entre tests
 * - Hardening de colas BullMQ
 * - Timeouts controlados
 * - Logging estructurado
 */

// ─── Redis Health ────────────────────────────────────────────────────────────
export {
  ensureRedisAvailable,
  requireRedis,
  isRedisPortOpen,
  type RedisHealthResult,
  type RedisHealthOptions,
} from "./redis-health";

// ─── Configuration Validation ────────────────────────────────────────────────
export {
  validateConfig,
  validateInfrastructure,
  requireInfrastructure,
  generateDiagnosticReport,
  type ValidationResult,
  type ConnectivityResult,
  type FullValidationResult,
  type InfraConfig,
} from "./config-validator";

// ─── Redis Isolation ─────────────────────────────────────────────────────────
export {
  getTestRunId,
  resetTestRunId,
  buildKeyPrefix,
  createIsolatedRedis,
  cleanupNamespace,
  cleanupCurrentTestRun,
  getBullMQTestOptions,
  cleanupBullMQQueues,
  listNamespaceKeys,
  isNamespaceEmpty,
  withIsolatedRedis,
  type IsolatedRedisConfig,
  type IsolatedRedisClient,
} from "./redis-isolation";

// ─── Queue Hardening ─────────────────────────────────────────────────────────
export {
  waitUntilQueueReady,
  getQueueHealth,
  waitUntilWorkerReady,
  getWorkerHealth,
  createTestQueue,
  createTestWorker,
  waitForJobCompletion,
  verifyJobProcessedOnce,
  cleanupQueue,
  closeWorker,
  type QueueHealthResult,
  type WorkerHealthResult,
  type QueueHardeningOptions,
  type JobCompletionResult,
} from "./queue-hardening";

// ─── Timeouts ────────────────────────────────────────────────────────────────
export {
  TIMEOUTS,
  getTimeout,
  withTimeout,
  withTimeoutSafe,
  withRetry,
  createDeadline,
  type RetryOptions,
} from "./timeouts";

// ─── Local Bootstrap (Dev Only) ──────────────────────────────────────────────
export {
  isBootstrapEnabled,
  bootstrapRedis,
  bootstrapLocalInfra,
  cleanupBootstrappedProcesses,
  type BootstrapResult,
  type LocalInfraConfig,
} from "./local-bootstrap";

// ─── Logging ─────────────────────────────────────────────────────────────────
export {
  infraLog,
  logDbConnection,
  logRedisConnection,
  logQueueOperation,
  measureAsync,
  withInfraLog,
  type LogLevel,
  type InfraLogOptions,
} from "./infra-logger";
