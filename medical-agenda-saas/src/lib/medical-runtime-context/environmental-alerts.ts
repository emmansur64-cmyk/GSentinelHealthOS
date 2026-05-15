import type {
  MedicalRuntimeContextConfig,
  MedicalRuntimeEnvironmentalAlert,
  MedicalRuntimeWeatherContext,
} from "./types";

export function buildEnvironmentalAlerts(
  config: MedicalRuntimeContextConfig,
  weather: MedicalRuntimeWeatherContext | null,
): MedicalRuntimeEnvironmentalAlert[] {
  if (!config.alertsEnabled) return [];
  const alerts: MedicalRuntimeEnvironmentalAlert[] = [];

  if (weather?.heatAlert) {
    alerts.push({
      type: "heat",
      severity: "watch",
      source: weather.source,
      summary: "Temperatura elevada detectada; usar solo como contexto auxiliar para hidratacion, golpe de calor y poblaciones vulnerables.",
    });
  }

  if (weather?.coldAlert) {
    alerts.push({
      type: "cold",
      severity: "watch",
      source: weather.source,
      summary: "Temperatura baja detectada; usar solo como contexto auxiliar para hipotermia, cuadros respiratorios y poblaciones vulnerables.",
    });
  }

  if (weather?.condition === "thunderstorm") {
    alerts.push({
      type: "storm",
      severity: "info",
      source: weather.source,
      summary: "Condicion compatible con tormenta; no implica causalidad clinica y no reemplaza alertas oficiales.",
    });
  }

  return alerts;
}

