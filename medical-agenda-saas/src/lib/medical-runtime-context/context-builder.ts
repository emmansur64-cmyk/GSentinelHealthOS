import { auditMedicalRuntimeContext, auditMedicalRuntimeContextError } from "./audit";
import { getRuntimeCache, setRuntimeCache } from "./cache";
import { getMedicalRuntimeContextConfig } from "./config";
import { buildEnvironmentalAlerts } from "./environmental-alerts";
import { buildEpidemiologyContext } from "./epidemiology-context";
import { buildTimeContext } from "./time-context";
import { buildWeatherContext } from "./weather-context";
import type { MedicalRuntimeContext, MedicalRuntimeContextInput } from "./types";

export const MEDICAL_RUNTIME_CONTEXT_INSTRUCTION =
  "Usar este contexto solo como informacion auxiliar. No asumir causalidad clinica automatica. No reemplazar criterio medico.";

function safeCacheKey(input: MedicalRuntimeContextInput, timezone: string, region: string | null): string {
  const tenant = input.tenantId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "tenant";
  const zone = timezone.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 60) || "timezone";
  const area = String(region ?? "no-region").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return `medical-runtime-context:v1:${tenant}:${zone}:${area}`;
}

function buildEmptyContext(input: MedicalRuntimeContextInput, errors: string[] = []): MedicalRuntimeContext {
  const config = getMedicalRuntimeContextConfig();
  const timezone = input.timezone?.trim() || config.timezone;
  const region = input.region?.trim() || config.region;
  const key = safeCacheKey(input, timezone, region);
  return {
    instruction: MEDICAL_RUNTIME_CONTEXT_INSTRUCTION,
    generatedAt: new Date().toISOString(),
    enabled: false,
    fallback: true,
    errors,
    cache: { key, hit: false, ttlSeconds: config.cacheTtlSeconds },
    time: buildTimeContext(timezone, config.latitude),
    weather: null,
    environmentalAlerts: [],
    epidemiology: buildEpidemiologyContext(),
  };
}

export async function buildMedicalRuntimeContext(
  input: MedicalRuntimeContextInput,
): Promise<MedicalRuntimeContext | null> {
  const config = getMedicalRuntimeContextConfig();
  if (!config.enabled) return null;

  const timezone = input.timezone?.trim() || config.timezone;
  const region = input.region?.trim() || config.region;
  const cacheKey = safeCacheKey(input, timezone, region);

  try {
    const cached = getRuntimeCache<MedicalRuntimeContext>(cacheKey);
    if (cached) {
      const result = {
        ...cached,
        cache: { ...cached.cache, hit: true },
      };
      auditMedicalRuntimeContext(result);
      return result;
    }

    const errors: string[] = [];
    const time = buildTimeContext(timezone, config.latitude);
    const weather = await buildWeatherContext({ ...config, timezone, region }).catch((error) => {
      errors.push(error instanceof Error && error.name === "AbortError" ? "weather_timeout" : "weather_failed");
      auditMedicalRuntimeContextError(error, "weather_failed");
      return null;
    });
    const environmentalAlerts = buildEnvironmentalAlerts(config, weather);
    const epidemiology = buildEpidemiologyContext();

    const result: MedicalRuntimeContext = {
      instruction: MEDICAL_RUNTIME_CONTEXT_INSTRUCTION,
      generatedAt: new Date().toISOString(),
      enabled: true,
      fallback: errors.length > 0,
      errors,
      cache: { key: cacheKey, hit: false, ttlSeconds: config.cacheTtlSeconds },
      time,
      weather,
      environmentalAlerts,
      epidemiology,
    };

    setRuntimeCache(cacheKey, result, config.cacheTtlSeconds);
    auditMedicalRuntimeContext(result);
    return result;
  } catch (error) {
    auditMedicalRuntimeContextError(error, "context_builder_failed");
    const fallback = buildEmptyContext(input, ["runtime_context_failed"]);
    auditMedicalRuntimeContext(fallback);
    return fallback;
  }
}

