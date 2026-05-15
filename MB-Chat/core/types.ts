export type LayerStatus = "active_legacy" | "adapter_ready" | "shadow_ready" | "disabled";

export type ClinicalTraceContext = {
  traceId: string;
  tenantId?: string;
  doctorId?: string;
  patientId?: string;
  requestId?: string;
};

export type LayerHealth = {
  name: string;
  status: LayerStatus;
  healthy: boolean;
  degraded: boolean;
  details?: Record<string, unknown>;
};

export type SafeFallback<T> = {
  value: T;
  fallbackUsed: boolean;
  reason?: string;
};

export type CurrentImplementationAdapter = {
  layer: string;
  currentPaths: string[];
  behaviorChanging: false;
  notes: string[];
};
