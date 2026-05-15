import { logServer, logServerError } from "@/lib/server-logger";

type AgendaApiCreateInput = {
  tenantId: string;
  doctorId: string;
  patientId: string;
  dateTimeIso: string;
  durationMinutes: number;
  reason?: string;
  idempotencyKey?: string;
};

type AgendaApiValidateSlotInput = {
  tenantId: string;
  doctorId: string;
  dateTimeIso: string;
};

type AgendaApiResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

type AgendaCreateResponse = {
  id: string;
  doctor_id: string;
  patient_id: string;
  date_time: string;
  status: string;
};

type AgendaValidateSlotResponse = {
  available: boolean;
  message?: string;
};

function getAgendaApiUrl(): string {
  return (process.env.AGENDA_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

function getAgendaApiKey(): string {
  return (process.env.GATEWAY_API_KEY ?? process.env.INTERNAL_SERVICES_KEY ?? "").trim();
}

function getAgendaApiTimeoutMs(): number {
  return Math.max(1000, Number(process.env.AGENDA_API_TIMEOUT_MS ?? "7000"));
}

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function isAgendaApiAuthorityEnabled(): boolean {
  return envFlag("AGENDA_API_AUTHORITY_ENABLED", true);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getAgendaApiTimeoutMs());
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildHeaders(input: { tenantId: string; idempotencyKey?: string; apiKey: string }): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Clinic-Id": input.tenantId,
  };

  if (input.apiKey) {
    headers["X-Internal-Key"] = input.apiKey;
  }

  if (input.idempotencyKey) {
    headers["Idempotency-Key"] = input.idempotencyKey;
  }

  return headers;
}

async function safeReadErrorBody(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === "string") return payload.detail;
    if (typeof payload?.message === "string") return payload.message;
  } catch {
    // ignore parse failure
  }
  return `agenda_api_http_${response.status}`;
}

export async function createAppointmentViaAgendaApi(input: AgendaApiCreateInput): Promise<AgendaApiResult<AgendaCreateResponse>> {
  const apiKey = getAgendaApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      error: "missing_internal_service_key",
    };
  }

  const payload = {
    doctor_id: input.doctorId,
    patient_id: input.patientId,
    date_time: input.dateTimeIso,
    reason: input.reason ?? `whatsapp booking (${input.durationMinutes}min)`,
    status: "scheduled",
  };

  const url = `${getAgendaApiUrl()}/api/v1/appointments`;

  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: buildHeaders({ tenantId: input.tenantId, idempotencyKey: input.idempotencyKey, apiKey }),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await safeReadErrorBody(response);
      logServer("warn", "agenda_api.create.failed", {
        status: response.status,
        reason: detail,
        route: "/api/v1/appointments",
      });
      return {
        ok: false,
        status: response.status,
        error: detail,
      };
    }

    const created = (await response.json()) as AgendaCreateResponse;
    return {
      ok: true,
      status: response.status,
      data: created,
    };
  } catch (error) {
    logServerError("agenda_api.create.exception", error, {
      route: "/api/v1/appointments",
      timeout_ms: getAgendaApiTimeoutMs(),
    });
    return {
      ok: false,
      status: 0,
      error: "agenda_api_unavailable",
    };
  }
}

export async function validateAvailabilityViaAgendaApi(
  input: AgendaApiValidateSlotInput,
): Promise<AgendaApiResult<AgendaValidateSlotResponse>> {
  const apiKey = getAgendaApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      error: "missing_internal_service_key",
    };
  }

  const route = `/api/v1/appointments/gateway/validate-slot?doctor_id=${encodeURIComponent(input.doctorId)}&appointment_time=${encodeURIComponent(input.dateTimeIso)}`;
  const url = `${getAgendaApiUrl()}${route}`;

  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: buildHeaders({ tenantId: input.tenantId, apiKey }),
    });

    if (!response.ok) {
      const detail = await safeReadErrorBody(response);
      return {
        ok: false,
        status: response.status,
        error: detail,
      };
    }

    const result = (await response.json()) as AgendaValidateSlotResponse;
    return {
      ok: true,
      status: response.status,
      data: result,
    };
  } catch (error) {
    logServerError("agenda_api.validate_slot.exception", error, {
      route,
      timeout_ms: getAgendaApiTimeoutMs(),
    });
    return {
      ok: false,
      status: 0,
      error: "agenda_api_unavailable",
    };
  }
}
