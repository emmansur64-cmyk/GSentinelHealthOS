type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

import { getObservabilityContext } from "@/lib/observability/context";

function normalizeError(error: unknown): LogMeta {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { error };
}

export function logServer(level: LogLevel, message: string, meta?: LogMeta) {
  const safeMeta = { ...(meta ?? {}) };
  if ("message" in safeMeta) {
    safeMeta.meta_message = safeMeta.message;
    delete safeMeta.message;
  }

  const obs = getObservabilityContext();
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    trace_id: obs?.traceId ?? null,
    message_id: obs?.messageId ?? null,
    user_phone: obs?.userPhone ?? null,
    intent: obs?.intent ?? null,
    ...safeMeta,
  };

  const text = JSON.stringify(entry);

  if (level === "error") {
    console.error(text);
    return;
  }
  if (level === "warn") {
    console.warn(text);
    return;
  }
  if (level === "debug") {
    console.debug(text);
    return;
  }
  console.info(text);
}

export function logServerError(message: string, error: unknown, meta?: LogMeta) {
  logServer("error", message, {
    ...normalizeError(error),
    ...(meta ?? {}),
  });
}
