export type MedicalRuntimeContextConfig = {
  enabled: boolean;
  weatherEnabled: boolean;
  alertsEnabled: boolean;
  cacheTtlSeconds: number;
  timeoutMs: number;
  timezone: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type MedicalRuntimeTimeContext = {
  timestamp: string;
  timezone: string;
  localDate: string;
  localTime: string;
  dayOfWeek: string;
  isNightShift: boolean;
  season: "summer" | "autumn" | "winter" | "spring";
  temporalContext: string;
};

export type MedicalRuntimeWeatherContext = {
  source: "open-meteo";
  observedAt: string | null;
  region: string | null;
  temperatureC: number | null;
  relativeHumidityPercent: number | null;
  pressureHPa: number | null;
  weatherCode: number | null;
  condition: string | null;
  airQuality: null;
  heatAlert: boolean;
  coldAlert: boolean;
};

export type MedicalRuntimeEnvironmentalAlert = {
  type: "heat" | "cold" | "smoke" | "respiratory" | "storm" | "vector";
  severity: "info" | "watch" | "warning";
  source: string;
  summary: string;
};

export type MedicalRuntimeEpidemiologyContext = {
  source: string;
  respiratoryOutbreaks: MedicalRuntimeEnvironmentalAlert[];
  dengueVectorAlerts: MedicalRuntimeEnvironmentalAlert[];
  influenzaAlerts: MedicalRuntimeEnvironmentalAlert[];
  notes: string[];
};

export type MedicalRuntimeContext = {
  instruction: string;
  generatedAt: string;
  enabled: boolean;
  fallback: boolean;
  errors: string[];
  cache: {
    key: string;
    hit: boolean;
    ttlSeconds: number;
  };
  time: MedicalRuntimeTimeContext;
  weather: MedicalRuntimeWeatherContext | null;
  environmentalAlerts: MedicalRuntimeEnvironmentalAlert[];
  epidemiology: MedicalRuntimeEpidemiologyContext;
};

export type MedicalRuntimeContextInput = {
  tenantId: string;
  doctorUserId: string;
  conversationId: string;
  message: string;
  timezone?: string | null;
  region?: string | null;
};

