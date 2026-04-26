/**
 * Infrastructure Logger
 *
 * Logging dedicado para operaciones de infraestructura.
 * Formato consistente: [INFRA] <component> <message> (<timing>)
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface InfraLogOptions {
  component?: string;
  durationMs?: number;
  details?: Record<string, unknown>;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const env = process.env.INFRA_LOG_LEVEL || process.env.LOG_LEVEL || "info";
  return (env as LogLevel) in LOG_LEVELS ? (env as LogLevel) : "info";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()];
}

// ─── Core Logger ─────────────────────────────────────────────────────────────

/**
 * Log de infraestructura con formato consistente.
 *
 * @example
 * infraLog("info", "Redis connected", { durationMs: 12 });
 * // Output: [INFRA] Redis connected (12ms)
 *
 * infraLog("error", "Database connection failed", { component: "PostgreSQL" });
 * // Output: [INFRA] PostgreSQL :: Database connection failed
 */
export function infraLog(
  level: LogLevel,
  message: string,
  options: InfraLogOptions = {},
): void {
  if (!shouldLog(level)) return;

  const { component, durationMs, details } = options;

  // Build formatted message
  let formatted = "[INFRA]";

  if (component) {
    formatted += ` ${component} ::`;
  }

  formatted += ` ${message}`;

  if (durationMs !== undefined) {
    formatted += ` (${durationMs}ms)`;
  }

  // Output based on level
  const logFn = getLogFunction(level);

  if (details && Object.keys(details).length > 0) {
    logFn(formatted, details);
  } else {
    logFn(formatted);
  }
}

function getLogFunction(level: LogLevel): typeof console.log {
  switch (level) {
    case "debug":
      return console.debug;
    case "info":
      return console.info;
    case "warn":
      return console.warn;
    case "error":
      return console.error;
  }
}

// ─── Specialized Loggers ─────────────────────────────────────────────────────

/**
 * Logger para conexiones de base de datos
 */
export function logDbConnection(
  status: "connecting" | "connected" | "disconnected" | "error",
  durationMs?: number,
  error?: string,
): void {
  const level = status === "error" ? "error" : "info";
  const message =
    status === "error"
      ? `Database connection failed: ${error}`
      : `Database ${status}`;

  infraLog(level, message, { component: "PostgreSQL", durationMs });
}

/**
 * Logger para conexiones de Redis
 */
export function logRedisConnection(
  status: "connecting" | "connected" | "disconnected" | "error",
  durationMs?: number,
  error?: string,
): void {
  const level = status === "error" ? "error" : "info";
  const message =
    status === "error" ? `Redis connection failed: ${error}` : `Redis ${status}`;

  infraLog(level, message, { component: "Redis", durationMs });
}

/**
 * Logger para operaciones de cola
 */
export function logQueueOperation(
  operation: "ready" | "paused" | "resumed" | "drained" | "error",
  queueName: string,
  durationMs?: number,
  error?: string,
): void {
  const level = operation === "error" ? "error" : "info";
  const message =
    operation === "error"
      ? `Queue ${queueName} error: ${error}`
      : `Queue ${queueName} ${operation}`;

  infraLog(level, message, { component: "BullMQ", durationMs });
}

// ─── Timing Utilities ────────────────────────────────────────────────────────

/**
 * Mide el tiempo de una operación async
 */
export async function measureAsync<T>(
  operation: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await operation();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs };
}

/**
 * Wrapper para operaciones con logging automático
 */
export async function withInfraLog<T>(
  level: LogLevel,
  message: string,
  operation: () => Promise<T>,
  options: Omit<InfraLogOptions, "durationMs"> = {},
): Promise<T> {
  const { result, durationMs } = await measureAsync(operation);
  infraLog(level, message, { ...options, durationMs });
  return result;
}
