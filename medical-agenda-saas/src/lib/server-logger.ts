type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

import { getObservabilityContext } from "@/lib/observability/context";

const SENSITIVE_KEY_REGEX = /(token|cookie|authorization|phone|telefono|dni|document|email|password|medical|clinical|payload|notes|content|message_text)/i;
const SENSITIVE_VALUE_REGEX = /(bearer\s+[a-z0-9._-]+|\+?\d{8,15}|\b\d{7,10}\b|@)/i;

function maskPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const suffix = digits.slice(-2);
  return `***${suffix}`;
}

function sanitizeMeta(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeMeta(item));
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (SENSITIVE_KEY_REGEX.test(key)) return [key, "[REDACTED]"];
      return [key, sanitizeMeta(item)];
    });
    return Object.fromEntries(entries);
  }
  if (typeof value === "string" && SENSITIVE_VALUE_REGEX.test(value)) {
    return "[REDACTED]";
  }
  return value;
}

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
  const safeMeta = { ...(sanitizeMeta(meta ?? {}) as LogMeta) };
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
    user_phone: maskPhone(obs?.userPhone),
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
