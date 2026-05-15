import { logServer, logServerError } from "@/lib/server-logger";
import type { MedicalRuntimeContext } from "./types";

export function auditMedicalRuntimeContext(result: MedicalRuntimeContext): void {
  try {
    logServer("info", "medical_runtime_context.audit", {
      generated_at: result.generatedAt,
      enabled: result.enabled,
      fallback: result.fallback,
      weather_source: result.weather?.source ?? null,
      alert_sources: Array.from(new Set(result.environmentalAlerts.map((item) => item.source))),
      cache_hit: result.cache.hit,
      cache_key: result.cache.key,
      ttl_seconds: result.cache.ttlSeconds,
      errors: result.errors,
    });
  } catch (error) {
    logServerError("medical_runtime_context.audit_failed", error, {
      fallback: true,
    });
  }
}

export function auditMedicalRuntimeContextError(error: unknown, reason: string): void {
  logServerError("medical_runtime_context.failed", error, {
    reason,
    fallback: true,
  });
}

