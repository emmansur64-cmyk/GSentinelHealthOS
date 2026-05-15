import { sanitizeRuntimeString } from "./sanitizer";
import type { MedicalRuntimeContextConfig, MedicalRuntimeWeatherContext } from "./types";

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    surface_pressure?: number;
    weather_code?: number;
  };
};

function weatherCodeToCondition(code: number | null): string | null {
  if (code === null) return null;
  if (code === 0) return "clear";
  if ([1, 2, 3].includes(code)) return "cloudy";
  if ([45, 48].includes(code)) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95) return "thunderstorm";
  return "unknown";
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<OpenMeteoResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`weather_http_${response.status}`);
    return (await response.json()) as OpenMeteoResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function buildWeatherContext(config: MedicalRuntimeContextConfig): Promise<MedicalRuntimeWeatherContext | null> {
  if (!config.weatherEnabled) return null;
  if (config.latitude === null || config.longitude === null) return null;

  const params = new URLSearchParams({
    latitude: String(config.latitude),
    longitude: String(config.longitude),
    current: "temperature_2m,relative_humidity_2m,surface_pressure,weather_code",
    timezone: "auto",
  });
  const data = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, config.timeoutMs);
  const current = data.current ?? {};
  const temperatureC = numberOrNull(current.temperature_2m);
  const weatherCode = numberOrNull(current.weather_code);

  return {
    source: "open-meteo",
    observedAt: sanitizeRuntimeString(current.time, 80) || null,
    region: config.region,
    temperatureC,
    relativeHumidityPercent: numberOrNull(current.relative_humidity_2m),
    pressureHPa: numberOrNull(current.surface_pressure),
    weatherCode,
    condition: weatherCodeToCondition(weatherCode),
    airQuality: null,
    heatAlert: temperatureC !== null && temperatureC >= 32,
    coldAlert: temperatureC !== null && temperatureC <= 5,
  };
}

