import IORedis from "ioredis";
import { observeRedisLatency } from "@/lib/observability/metrics";
import { logServer } from "@/lib/server-logger";

let _connection: IORedis | null = null;
let _startupCheckRan = false;
let _redisAvailable = false;
let _lastRedisErrorFingerprint = "";
let _lastRedisErrorLogAt = 0;
let _suppressedRedisErrorCount = 0;
let _lastRedisReconnectDelay = -1;
let _lastRedisReconnectLogAt = 0;
let _suppressedRedisReconnectCount = 0;
let _circuitOpen = false;
let _circuitResetTimer: ReturnType<typeof setTimeout> | null = null;

const REDIS_LOG_THROTTLE_MS = 30_000;

// Maximum number of retries before entering circuit-open state.
// Override via REDIS_MAX_RETRIES env var.
const REDIS_MAX_RETRIES = (() => {
  const v = parseInt(process.env.REDIS_MAX_RETRIES ?? "20", 10);
  return Number.isFinite(v) && v > 0 ? v : 20;
})();

// Minimum interval (ms) before attempting a full reconnection while
// the circuit is open. Defaults to 5 minutes.
const REDIS_CIRCUIT_RESET_MS = (() => {
  const v = parseInt(process.env.REDIS_CIRCUIT_RESET_MS ?? "300000", 10);
  return Number.isFinite(v) && v >= 30_000 ? v : 300_000;
})();

/**
 * Exponential backoff retry strategy:
 *   Phase 1 (attempts 1-5):  200 ms → 1 s  (fast, for transient blips)
 *   Phase 2 (attempts 6-N):  2 s → 5 min   (exponential cap, reduces log noise)
 *   Phase 3 (> REDIS_MAX_RETRIES): circuit open — returns null to stop IORedis
 *                             retrying; a one-shot timer will reset the
 *                             connection after REDIS_CIRCUIT_RESET_MS.
 */
function buildRetryStrategy(): (times: number) => number | null {
  return (times: number): number | null => {
    if (times <= 5) {
      return Math.min(times * 200, 1_000);
    }
    if (times <= REDIS_MAX_RETRIES) {
      // Doubles every attempt, capped at 5 minutes.
      return Math.min(1_000 * Math.pow(2, times - 5), 5 * 60_000);
    }

    // Circuit opens exactly once per connection lifetime.
    if (!_circuitOpen) {
      _circuitOpen = true;
      logServer("warn", "redis.circuit.open", {
        retries_exhausted: times,
        reset_in_ms: REDIS_CIRCUIT_RESET_MS,
      });
      scheduleCircuitReset();
    }
    return null; // Stop IORedis from retrying.
  };
}

function scheduleCircuitReset(): void {
  if (_circuitResetTimer !== null) return;
  _circuitResetTimer = setTimeout(async () => {
    _circuitResetTimer = null;
    logServer("info", "redis.circuit.reset.attempt", {});
    await closeRedis();
    _circuitOpen = false;
    // Eagerly create new connection so in-flight requests benefit immediately.
    getRedisConnection();
  }, REDIS_CIRCUIT_RESET_MS);
}

const memoryFallback = {
  kv: new Map<string, string>(),
  counters: new Map<string, number>(),
  lists: new Map<string, string[]>(),
};

type RedisConfig = {
  host: string;
  port: number;
  url?: string;
};

function getRedisConfig(): RedisConfig {
  const host = (process.env.REDIS_HOST || "localhost").trim();
  const portRaw = process.env.REDIS_PORT || "6379";
  const parsedPort = Number.parseInt(portRaw, 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 6379;
  const urlRaw = process.env.REDIS_URL?.trim();

  if (urlRaw) {
    try {
      const parsed = new URL(urlRaw);
      if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
        throw new Error(`protocolo no soportado: ${parsed.protocol}`);
      }
      return { host, port, url: urlRaw };
    } catch (error) {
      logServer("error", "redis.config.invalid_url", {
        redis_url: urlRaw,
        message: error instanceof Error ? error.message : "invalid_redis_url",
      });
    }
  }

  if (process.env.NODE_ENV === "production") {
    logServer("warn", "redis.config.fallback_host_port", {
      host,
      port,
      reason: "REDIS_URL_missing_or_invalid",
    });
  }

  return { host, port };
}

function createRedisClient(config: RedisConfig): IORedis {
  const retryStrategy = buildRetryStrategy();

  const sharedOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 5_000,
    lazyConnect: false,
    retryStrategy,
    reconnectOnError(err: Error) {
      // Only auto-reconnect on transient socket errors, not auth failures.
      const code = (err as NodeJS.ErrnoException).code ?? "";
      return code === "ECONNRESET" || code === "ETIMEDOUT";
    },
  } as const;

  const instance = config.url
    ? new IORedis(config.url, sharedOptions)
    : new IORedis({ host: config.host, port: config.port, ...sharedOptions });

  instance.on("error", (err) => {
    _redisAvailable = false;
    const message =
      err instanceof Error
        ? err.message || err.name || "redis_error"
        : typeof err === "string"
          ? err
          : "redis_error";

    const code = typeof err === "object" && err && "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
    const address =
      typeof err === "object" && err && "address" in err ? String((err as { address?: unknown }).address ?? "") : "";
    const port = typeof err === "object" && err && "port" in err ? String((err as { port?: unknown }).port ?? "") : "";
    const fingerprint = `${message}|${code}|${address}|${port}`;
    const now = Date.now();
    const shouldLog =
      fingerprint !== _lastRedisErrorFingerprint || now - _lastRedisErrorLogAt >= REDIS_LOG_THROTTLE_MS;

    if (!shouldLog) {
      _suppressedRedisErrorCount += 1;
      return;
    }

    logServer("warn", "redis.connection.error", {
      error_message: message,
      error_code: code || undefined,
      error_address: address || undefined,
      error_port: port || undefined,
      suppressed_duplicates: _suppressedRedisErrorCount || undefined,
    });

    _lastRedisErrorFingerprint = fingerprint;
    _lastRedisErrorLogAt = now;
    _suppressedRedisErrorCount = 0;
  });

  instance.on("connect", () => {
    logServer("info", "redis.connection.connect", {
      host: config.url ? "from_url" : config.host,
      port: config.url ? null : config.port,
    });
  });

  instance.on("ready", () => {
    _redisAvailable = true;
    logServer("info", "redis.connection.ready", {});
  });

  instance.on("reconnecting", (delay: number) => {
    _redisAvailable = false;
    const now = Date.now();
    const sameDelay = delay === _lastRedisReconnectDelay;
    const shouldLog = !sameDelay || now - _lastRedisReconnectLogAt >= REDIS_LOG_THROTTLE_MS;

    if (!shouldLog) {
      _suppressedRedisReconnectCount += 1;
      return;
    }

    logServer("warn", "redis.connection.reconnecting", {
      delay_ms: delay,
      suppressed_duplicates: _suppressedRedisReconnectCount || undefined,
    });

    _lastRedisReconnectDelay = delay;
    _lastRedisReconnectLogAt = now;
    _suppressedRedisReconnectCount = 0;
  });

  instance.on("end", () => {
    _redisAvailable = false;
    logServer("warn", "redis.connection.end", {});
  });

  return instance;
}

async function validateRedisOnStartup(connection: IORedis): Promise<void> {
  if (_startupCheckRan) return;
  _startupCheckRan = true;

  try {
    await connection.ping();
    _redisAvailable = true;
    logServer("info", "redis.startup.validation.ok", {});
  } catch (error) {
    _redisAvailable = false;
    logServer("warn", "redis.startup.validation.failed", {
      message: error instanceof Error ? error.message : "unknown_error",
      fallback: "memory",
    });
  }
}

export function isRedisAvailable(): boolean {
  return _redisAvailable;
}

export async function withRedisFallback<T>(
  operation: (redis: IORedis) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  try {
    const redis = getRedisConnection();
    const result = await operation(redis);
    _redisAvailable = true;
    return result;
  } catch (error) {
    _redisAvailable = false;
    logServer("warn", "redis.operation.fallback", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return await fallback();
  }
}

export async function setMemoryFallbackKey(key: string, value: string, ttlSeconds?: number): Promise<void> {
  memoryFallback.kv.set(key, value);
  if (ttlSeconds && ttlSeconds > 0) {
    setTimeout(() => {
      memoryFallback.kv.delete(key);
    }, ttlSeconds * 1000);
  }
}

export function incrMemoryFallbackCounter(key: string, amount = 1): number {
  const next = (memoryFallback.counters.get(key) ?? 0) + amount;
  memoryFallback.counters.set(key, next);
  return next;
}

export function lpushMemoryFallbackList(key: string, value: string, maxItems = 200): number {
  const current = memoryFallback.lists.get(key) ?? [];
  current.unshift(value);
  if (current.length > maxItems) {
    current.length = maxItems;
  }
  memoryFallback.lists.set(key, current);
  return current.length;
}

export function getRedisConnection(): IORedis {
  if (!_connection) {
    const config = getRedisConfig();
    _connection = createRedisClient(config);
    void validateRedisOnStartup(_connection);

    const rawSendCommand = _connection.sendCommand.bind(_connection);
    _connection.sendCommand = (command, stream) => {
      const started = performance.now();
      const operation = String(command?.name ?? "unknown").toLowerCase();
      const result = rawSendCommand(command, stream);
      Promise.resolve(result).finally(() => {
        observeRedisLatency(operation, performance.now() - started);
      });
      return result;
    };
  }
  return _connection;
}

export async function closeRedis(): Promise<void> {
  if (_circuitResetTimer !== null) {
    clearTimeout(_circuitResetTimer);
    _circuitResetTimer = null;
  }
  _circuitOpen = false;
  if (_connection) {
    await _connection.quit();
    _connection = null;
    _redisAvailable = false;
    _startupCheckRan = false;
  }
}

/**
 * Force-reset circuit breaker and reconnect immediately.
 * Useful for admin endpoints or when Redis becomes available again.
 */
export async function resetRedisCircuit(): Promise<void> {
  await closeRedis();
  logServer("info", "redis.circuit.manual_reset", {});
  getRedisConnection();
}
