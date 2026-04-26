import {
  getRedisConnection,
  incrMemoryFallbackCounter,
  lpushMemoryFallbackList,
  setMemoryFallbackKey,
  withRedisFallback,
} from "@/lib/whatsapp/redis";
import { logServer } from "@/lib/server-logger";

type MetaBrainSeverity = "info" | "warn" | "error";

type MetaBrainSignalPayload = {
  event: string;
  severity?: MetaBrainSeverity;
  details?: Record<string, unknown>;
};

const HEARTBEAT_KEY = "brain:integration:medical_agenda:heartbeat";
const LAST_SIGNAL_KEY = "brain:integration:medical_agenda:last_signal";
const SIGNAL_STREAM_KEY = "brain:integration:events";

async function withShortTimeout<T>(promise: Promise<T>, timeoutMs = 300): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("REDIS_TIMEOUT")), timeoutMs);
    }),
  ]);
}

export async function publishMetaBrainSignal(payload: MetaBrainSignalPayload): Promise<boolean> {
  const severity = payload.severity ?? "info";
  const envelope = {
    source: "medical-agenda-saas",
    ts: new Date().toISOString(),
    event: payload.event,
    severity,
    details: payload.details ?? {},
  };

  const serialized = JSON.stringify(envelope);

  return await withRedisFallback(
    async (redis) => {
      await withShortTimeout(
        Promise.all([
          redis.set(LAST_SIGNAL_KEY, serialized, "EX", 300),
          redis.lpush(SIGNAL_STREAM_KEY, serialized),
          redis.ltrim(SIGNAL_STREAM_KEY, 0, 199),
          redis.incr("brain:metrics:medical_agenda_signals_total"),
        ]),
      );
      return true;
    },
    async () => {
      await setMemoryFallbackKey(LAST_SIGNAL_KEY, serialized, 300);
      lpushMemoryFallbackList(SIGNAL_STREAM_KEY, serialized, 200);
      incrMemoryFallbackCounter("brain:metrics:medical_agenda_signals_total");
      logServer("warn", "metabrain.signal.memory_fallback", { event: payload.event });
      return false;
    },
  );
}

export async function publishMetaBrainHeartbeat(status: "ok" | "degraded", details?: Record<string, unknown>): Promise<boolean> {
  const envelope = {
    source: "medical-agenda-saas",
    ts: new Date().toISOString(),
    status,
    details: details ?? {},
  };

  return await withRedisFallback(
    async (redis) => {
      await withShortTimeout(
        Promise.all([
          redis.set(HEARTBEAT_KEY, JSON.stringify(envelope), "EX", 120),
          redis.incr("brain:metrics:medical_agenda_heartbeat_total"),
        ]),
      );
      return true;
    },
    async () => {
      await setMemoryFallbackKey(HEARTBEAT_KEY, JSON.stringify(envelope), 120);
      incrMemoryFallbackCounter("brain:metrics:medical_agenda_heartbeat_total");
      logServer("warn", "metabrain.heartbeat.memory_fallback", { status });
      return false;
    },
  );
}
