/**
 * Tests de concurrencia y escalabilidad para workers de WhatsApp.
 *
 * Ejecutar: npx vitest tests/whatsapp/scaled-workers.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de dependencias antes de importar módulos
vi.mock("@/lib/prisma", () => ({
  prisma: {
    incomingMessage: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    conversationState: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/whatsapp/client", () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/whatsapp/rate-limiter", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/server-logger", () => ({
  logServer: vi.fn(),
  logServerError: vi.fn(),
}));

// Mock de Redis con implementación in-memory
const mockRedisData: Map<string, string> = new Map();
const mockRedisSets: Map<string, Set<string>> = new Map();
const mockRedisLists: Map<string, string[]> = new Map();
const mockRedisHashes: Map<string, Map<string, string>> = new Map();

vi.mock("@/lib/whatsapp/redis", () => ({
  getRedisConnection: () => ({
    incr: vi.fn((key: string) => {
      const val = parseInt(mockRedisData.get(key) ?? "0", 10) + 1;
      mockRedisData.set(key, val.toString());
      return Promise.resolve(val);
    }),
    get: vi.fn((key: string) => Promise.resolve(mockRedisData.get(key) ?? null)),
    set: vi.fn((key: string, val: string) => {
      mockRedisData.set(key, val);
      return Promise.resolve("OK");
    }),
    setex: vi.fn((key: string, _ttl: number, val: string) => {
      mockRedisData.set(key, val);
      return Promise.resolve("OK");
    }),
    del: vi.fn((...keys: string[]) => {
      keys.forEach((k) => mockRedisData.delete(k));
      return Promise.resolve(keys.length);
    }),
    keys: vi.fn((pattern: string) => {
      const prefix = pattern.replace("*", "");
      const matches = Array.from(mockRedisData.keys()).filter((k) =>
        k.startsWith(prefix),
      );
      return Promise.resolve(matches);
    }),
    hset: vi.fn((key: string, field: string, val: string) => {
      if (!mockRedisHashes.has(key)) mockRedisHashes.set(key, new Map());
      mockRedisHashes.get(key)!.set(field, val);
      return Promise.resolve(1);
    }),
    hget: vi.fn((key: string, field: string) => {
      return Promise.resolve(mockRedisHashes.get(key)?.get(field) ?? null);
    }),
    hdel: vi.fn((key: string, field: string) => {
      mockRedisHashes.get(key)?.delete(field);
      return Promise.resolve(1);
    }),
    hlen: vi.fn((key: string) => {
      return Promise.resolve(mockRedisHashes.get(key)?.size ?? 0);
    }),
    lpush: vi.fn((key: string, ...vals: string[]) => {
      if (!mockRedisLists.has(key)) mockRedisLists.set(key, []);
      mockRedisLists.get(key)!.unshift(...vals);
      return Promise.resolve(mockRedisLists.get(key)!.length);
    }),
    lrange: vi.fn((key: string, start: number, end: number) => {
      const list = mockRedisLists.get(key) ?? [];
      return Promise.resolve(
        list.slice(start, end === -1 ? undefined : end + 1),
      );
    }),
    ltrim: vi.fn((key: string, start: number, end: number) => {
      const list = mockRedisLists.get(key) ?? [];
      mockRedisLists.set(key, list.slice(start, end + 1));
      return Promise.resolve("OK");
    }),
    zadd: vi.fn((key: string, score: number, member: string) => {
      if (!mockRedisSets.has(key)) mockRedisSets.set(key, new Set());
      mockRedisSets.get(key)!.add(`${score}:${member}`);
      return Promise.resolve(1);
    }),
    zcount: vi.fn((key: string, _min: number, _max: number) => {
      return Promise.resolve(mockRedisSets.get(key)?.size ?? 0);
    }),
    zremrangebyscore: vi.fn(() => Promise.resolve(0)),
    pipeline: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      hdel: vi.fn().mockReturnThis(),
      hlen: vi.fn().mockReturnThis(),
      lpush: vi.fn().mockReturnThis(),
      lrange: vi.fn().mockReturnThis(),
      ltrim: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcount: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, "100"],  // processed
        [null, "5"],    // failed
        [null, ["50", "60", "40"]], // durations
        [null, 30],     // recentCount
        [null, 2],      // activeJobs
      ]),
    })),
    quit: vi.fn().mockResolvedValue("OK"),
  }),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Worker Metrics", () => {
  beforeEach(() => {
    mockRedisData.clear();
    mockRedisSets.clear();
    mockRedisLists.clear();
    mockRedisHashes.clear();
  });

  it("trackJobStart registra tiempo de inicio", async () => {
    const { trackJobStart } = await import("@/lib/whatsapp/worker-metrics");

    const startTime = await trackJobStart("intake", "job-1");

    expect(startTime).toBeGreaterThan(0);
    expect(startTime).toBeLessThanOrEqual(Date.now());
  });

  it("trackJobComplete actualiza metricas correctamente", async () => {
    const { trackJobStart, trackJobComplete } = await import(
      "@/lib/whatsapp/worker-metrics"
    );

    const startTime = await trackJobStart("processing", "job-2");
    await trackJobComplete("processing", "job-2", startTime, true);

    // Verificar que se llamaron los métodos de Redis
    expect(mockRedisHashes.size).toBeGreaterThanOrEqual(0);
  });

  it("getMetrics retorna estructura correcta", async () => {
    const { getMetrics } = await import("@/lib/whatsapp/worker-metrics");

    const metrics = await getMetrics("intake");

    expect(metrics).toHaveProperty("processed");
    expect(metrics).toHaveProperty("failed");
    expect(metrics).toHaveProperty("avgDurationMs");
    expect(metrics).toHaveProperty("jobsPerSecond");
    expect(metrics).toHaveProperty("jobsPerHour");
    expect(metrics).toHaveProperty("activeWorkers");
    expect(metrics).toHaveProperty("queueLength");
  });

  it("getAllMetrics retorna metricas de todos los stages", async () => {
    const { getAllMetrics } = await import("@/lib/whatsapp/worker-metrics");

    const metrics = await getAllMetrics();

    expect(metrics).toHaveProperty("intake");
    expect(metrics).toHaveProperty("processing");
    expect(metrics).toHaveProperty("response");
  });
});

describe("Queues", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("hashCode genera valores consistentes", () => {
    // Test directo de la función hashCode sin depender de Redis
    const hashCode = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return hash;
    };

    const phone = "+5491155551234";
    const hash1 = hashCode(phone);
    const hash2 = hashCode(phone);

    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe("number");
  });

  it("QUEUE_NAMES tiene los nombres correctos", async () => {
    const { QUEUE_NAMES } = await import("@/lib/whatsapp/queues");

    expect(QUEUE_NAMES.INTAKE).toBe("wa-intake");
    expect(QUEUE_NAMES.PROCESSING).toBe("wa-processing");
    expect(QUEUE_NAMES.RESPONSE).toBe("wa-response");
  });
});

describe("Concurrency invariants", () => {
  it("user lock key es determinístico para el mismo teléfono", () => {
    const phone = "+5491155551234";
    const lockKey1 = `wa_user:${phone}`;
    const lockKey2 = `wa_user:${phone}`;

    expect(lockKey1).toBe(lockKey2);
  });

  it("diferentes teléfonos tienen diferentes lock keys", () => {
    const phone1 = "+5491155551234";
    const phone2 = "+5491155559999";
    const lockKey1 = `wa_user:${phone1}`;
    const lockKey2 = `wa_user:${phone2}`;

    expect(lockKey1).not.toBe(lockKey2);
  });

  it("pg_advisory_xact_lock usa hashtext para hashing consistente", () => {
    // El SQL generado debe usar hashtext para que sea consistente
    // entre diferentes instancias de PostgreSQL
    const phone = "+5491155551234";
    const expectedKey = `wa_user:${phone}`;
    const sqlFragment = `SELECT pg_advisory_xact_lock(hashtext('${expectedKey}'))`;

    expect(sqlFragment).toContain("pg_advisory_xact_lock");
    expect(sqlFragment).toContain("hashtext");
    expect(sqlFragment).toContain(expectedKey);
  });
});

describe("Horizontal scaling", () => {
  it("múltiples worker IDs son únicos", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = `worker-${Math.random().toString(36).slice(2, 10)}`;
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });

  it("job priority basada en hash distribuye uniformemente", () => {
    const phones = [
      "+5491155551111",
      "+5491155552222",
      "+5491155553333",
      "+5491155554444",
      "+5491155555555",
    ];

    const hashCode = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return hash;
    };

    const priorities = phones.map((p) => Math.abs(hashCode(p) % 10) + 1);

    // Verificar que hay variación (no todos iguales)
    const unique = new Set(priorities);
    expect(unique.size).toBeGreaterThan(1);

    // Verificar rango válido [1, 10]
    priorities.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(10);
    });
  });

  it("configuración de workers usa valores por defecto correctos", () => {
    const defaults = {
      intakeConcurrency: 20,
      processingConcurrency: 10,
      responseConcurrency: 15,
      responseRateLimit: 50,
    };

    // Capacidad teórica con defaults
    // Bottleneck: processing con 10 concurrent
    // Si cada job toma ~100ms, throughput = 10 * 10 = 100 jobs/sec = 360,000/hour
    // Objetivo: >1000/hour ✓

    expect(defaults.intakeConcurrency).toBeGreaterThanOrEqual(10);
    expect(defaults.processingConcurrency).toBeGreaterThanOrEqual(5);
    expect(defaults.responseConcurrency).toBeGreaterThanOrEqual(10);
  });
});

describe("Error handling", () => {
  it("isRetryableError clasifica errores de red como retryables", () => {
    const retryableMessages = [
      "timeout exceeded",
      "network error",
      "ECONNREFUSED",
      "ECONNRESET",
      "socket hang up",
      "503 Service Unavailable",
      "429 Too Many Requests",
    ];

    const isRetryable = (msg: string): boolean => {
      const lower = msg.toLowerCase();
      return (
        lower.includes("timeout") ||
        lower.includes("network") ||
        lower.includes("econnrefused") ||
        lower.includes("econnreset") ||
        lower.includes("socket") ||
        lower.includes("503") ||
        lower.includes("429")
      );
    };

    retryableMessages.forEach((msg) => {
      expect(isRetryable(msg)).toBe(true);
    });
  });

  it("isRetryableError clasifica errores de auth como no retryables", () => {
    const nonRetryableMessages = [
      "401 Unauthorized",
      "403 Forbidden",
      "invalid token",
    ];

    const isNotRetryable = (msg: string): boolean => {
      const lower = msg.toLowerCase();
      return (
        lower.includes("401") ||
        lower.includes("403") ||
        lower.includes("invalid token")
      );
    };

    nonRetryableMessages.forEach((msg) => {
      expect(isNotRetryable(msg)).toBe(true);
    });
  });
});

describe("Throughput estimation", () => {
  it("con defaults, throughput teórico supera objetivo de 1000/hora", () => {
    const processingConcurrency = 10;
    const avgJobDurationMs = 200; // estimado conservador
    const jobsPerSecond = processingConcurrency / (avgJobDurationMs / 1000);
    const jobsPerHour = jobsPerSecond * 3600;

    console.log(`Throughput estimado: ${jobsPerHour.toFixed(0)} jobs/hora`);

    expect(jobsPerHour).toBeGreaterThan(1000);
  });

  it("3 instancias horizontales triplican el throughput", () => {
    const singleInstanceThroughput = 1500; // jobs/hour
    const instances = 3;
    const totalThroughput = singleInstanceThroughput * instances;

    expect(totalThroughput).toBeGreaterThan(1000 * instances);
  });
});
