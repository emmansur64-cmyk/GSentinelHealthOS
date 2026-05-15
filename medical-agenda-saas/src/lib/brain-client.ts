import "server-only";
import { logServer, logServerError } from "@/lib/server-logger";
import { incDoctorChatFetchFailed } from "@/lib/observability/metrics";

/**
 * Respuesta normalizada de integracion con Brain Python.
 */
export type BrainDecideResponse = {
  action: string;
  response: string;
  confidence: number;
  source: "METABRAIN" | "knowledge_base" | string;
  entities: Record<string, unknown>;
  model_version: string;
};

/**
 * Modos de asistente válidos para el contrato conversacional.
 * Deben coincidir exactamente con AssistantMode en brain/contracts/routing.py
 */
export type AssistantMode =
  | "doctor_professional"
  | "patient_assistant"
  | "patient_triage"
  | "receptionist"
  | "administrative"
  | "generic_non_clinical";

export type ActorRole = "doctor" | "patient" | "receptionist" | "admin" | "system";

/**
 * Payload que enviamos al Brain.
 */
type BrainDecidePayload = {
  role: string;
  message: string;
  assistant_mode?: AssistantMode;
  actor_role?: ActorRole;
  context: {
    doctor_id?: string | null;
    patient?: { id?: string; name?: string; notes?: string | null } | null;
    current_appointment?: {
      id?: string;
      datetime?: string;
      status?: string;
      notes?: string | null;
    } | null;
    recent_history?: unknown[];
    conversation_history?: { doctor_message: string; response: string }[];
    clinical_state?: string | null;
    metadata?: Record<string, unknown>;
  };
};

const BRAIN_API_URL = (process.env.BRAIN_API_URL ?? "http://localhost:8001").replace(/\/$/, "");
const BRAIN_API_KEY = (process.env.BRAIN_API_KEY ?? process.env.INTERNAL_SERVICES_KEY ?? "").trim();
const BRAIN_TIMEOUT_MS = Number(process.env.BRAIN_TIMEOUT_MS ?? "10000");
const BRAIN_RETRY_ATTEMPTS = Math.max(1, Number(process.env.BRAIN_RETRY_ATTEMPTS ?? "2"));
const BRAIN_RETRY_DELAY_MS = Math.max(0, Number(process.env.BRAIN_RETRY_DELAY_MS ?? "250"));
const BRAIN_FAILURE_ALERT_THRESHOLD = Math.max(
  1,
  Number(process.env.BRAIN_FAILURE_ALERT_THRESHOLD ?? "5"),
);

let consecutiveBrainFailures = 0;

class BrainAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrainAuthError";
  }
}

function isPlaceholderBrainApiKey(value: string): boolean {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes("change-me") ||
    normalized.includes("change_production") ||
    normalized.includes("brain-secret-key-change-production")
  );
}

type OrchestrateApiResponse = {
  message: string;
  session_id: string;
  metadata?: {
    confidence?: number;
    [key: string]: unknown;
  };
};

type FetchErrorMeta = {
  name: string;
  message: string;
  code: string;
  cause: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFetchError(error: unknown): FetchErrorMeta {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      message: String(error),
      code: "unknown",
      cause: "unknown",
    };
  }

  const causeObj =
    typeof (error as Error & { cause?: unknown }).cause === "object" &&
    (error as Error & { cause?: unknown }).cause
      ? ((error as Error & { cause?: unknown }).cause as Record<string, unknown>)
      : undefined;

  const code = String(
    causeObj?.code ||
      (error as Error & { code?: string }).code ||
      error.name ||
      "error",
  );

  const cause = String(
    causeObj?.message ||
      causeObj?.code ||
      error.message ||
      "unknown",
  );

  return {
    name: error.name,
    message: error.message,
    code,
    cause,
  };
}

function registerConsecutiveFailure(meta: {
  endpoint: string;
  reason: string;
  targetUrl: string;
  timeoutMs: number;
}): void {
  consecutiveBrainFailures += 1;
  if (consecutiveBrainFailures >= BRAIN_FAILURE_ALERT_THRESHOLD) {
    logServer("error", "brain.fetch.failure_threshold_reached", {
      endpoint: meta.endpoint,
      reason: meta.reason,
      target_url: meta.targetUrl,
      timeout_ms: meta.timeoutMs,
      consecutive_failures: consecutiveBrainFailures,
      threshold: BRAIN_FAILURE_ALERT_THRESHOLD,
    });
  }
}

function registerSuccessIfRecovered(): void {
  if (consecutiveBrainFailures > 0) {
    logServer("info", "brain.fetch.recovered", {
      consecutive_failures_before_recovery: consecutiveBrainFailures,
    });
    consecutiveBrainFailures = 0;
  }
}

async function fetchWithRetry(
  endpointName: "orchestrate" | "legacy_decide",
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= BRAIN_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status >= 500 && attempt < BRAIN_RETRY_ATTEMPTS) {
        logServer("warn", "brain.fetch.retrying_http_error", {
          endpoint: endpointName,
          target_url: url,
          timeout_ms: BRAIN_TIMEOUT_MS,
          attempt,
          max_attempts: BRAIN_RETRY_ATTEMPTS,
          status: response.status,
        });
        await sleep(BRAIN_RETRY_DELAY_MS);
        continue;
      }
      return response;
    } catch (error) {
      lastErr = error;
      const errMeta = normalizeFetchError(error);
      incDoctorChatFetchFailed(endpointName, errMeta.code);
      registerConsecutiveFailure({
        endpoint: endpointName,
        reason: errMeta.code,
        targetUrl: url,
        timeoutMs: BRAIN_TIMEOUT_MS,
      });

      if (attempt < BRAIN_RETRY_ATTEMPTS) {
        logServer("warn", "brain.fetch.retrying_network_error", {
          endpoint: endpointName,
          target_url: url,
          timeout_ms: BRAIN_TIMEOUT_MS,
          attempt,
          max_attempts: BRAIN_RETRY_ATTEMPTS,
          error_code: errMeta.code,
          error_cause: errMeta.cause,
          error_name: errMeta.name,
          error_message: errMeta.message,
        });
        await sleep(BRAIN_RETRY_DELAY_MS);
        continue;
      }
    }
  }

  throw lastErr;
}

function buildSessionId(payload: BrainDecidePayload): string | null {
  const metadata = payload.context.metadata ?? {};
  const conversationId = metadata.conversation_id;
  if (typeof conversationId === "string" && conversationId.trim()) {
    return conversationId.trim();
  }

  const doctorId = payload.context.doctor_id?.trim();
  if (doctorId) {
    const patientId = payload.context.patient?.id?.trim() || "general";
    return `doctor:${doctorId}:patient:${patientId}`;
  }
  return null;
}

/**
 * Llama al endpoint POST /api/v1/brain/decide del servicio Brain (FastAPI).
 * Retorna null si el servicio no está disponible o responde con error.
 * El caller debe aplicar el fallback local en ese caso.
 */
export async function callBrainDecide(
  payload: BrainDecidePayload,
): Promise<BrainDecideResponse | null> {
  if (isPlaceholderBrainApiKey(BRAIN_API_KEY)) {
    logServer("error", "brain.auth.misconfigured", {
      target_url: `${BRAIN_API_URL}/orchestrate`,
      message: "BRAIN_API_KEY no configurada o invalida en frontend server",
    });
    return null;
  }

  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (BRAIN_API_KEY) {
    authHeaders["X-Internal-Key"] = BRAIN_API_KEY;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BRAIN_TIMEOUT_MS);

  try {
    const orchestrateUrl = `${BRAIN_API_URL}/orchestrate`;
    // 1) Camino principal: orquestador central (respuesta natural y contextual).
    const orchestrateRes = await fetchWithRetry("orchestrate", orchestrateUrl, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        user_input: payload.message,
        session_id: buildSessionId(payload),
        context: payload.context,
        // Contrato conversacional: necesario para role isolation en el Brain.
        // Sin estos campos el Brain cae a generic_non_clinical (más restrictivo).
        assistant_mode: payload.assistant_mode ?? "generic_non_clinical",
        actor_role: payload.actor_role ?? "system",
      }),
      signal: controller.signal,
    });

    if (orchestrateRes.ok) {
      const orchestrateData = (await orchestrateRes.json()) as OrchestrateApiResponse;
      registerSuccessIfRecovered();
      return {
        action: "orchestrated_reply",
        response: String(orchestrateData.message ?? ""),
        confidence: Number(orchestrateData.metadata?.confidence ?? 0.9),
        source: "ORCHESTRATOR",
        entities: {},
        model_version: "orchestrator-v2",
      };
    }

    if (orchestrateRes.status === 401 || orchestrateRes.status === 403) {
      throw new BrainAuthError("Brain rechazo autenticacion. Verifica BRAIN_API_KEY");
    }

    const orchestrateErr = await orchestrateRes.text().catch(() => "");
    logServer("warn", "Brain /orchestrate respondió con error; fallback a /api/v1/brain/decide", {
      target_url: orchestrateUrl,
      timeout_ms: BRAIN_TIMEOUT_MS,
      status: orchestrateRes.status,
      body: orchestrateErr.slice(0, 200),
    });
    incDoctorChatFetchFailed("orchestrate", `http_${orchestrateRes.status}`);
    registerConsecutiveFailure({
      endpoint: "orchestrate",
      reason: `http_${orchestrateRes.status}`,
      targetUrl: orchestrateUrl,
      timeoutMs: BRAIN_TIMEOUT_MS,
    });

    // 2) Fallback de compatibilidad: endpoint legacy /api/v1/brain/decide.
    const legacyUrl = `${BRAIN_API_URL}/api/v1/brain/decide`;
    const res = await fetchWithRetry("legacy_decide", legacyUrl, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new BrainAuthError("Brain rechazo autenticacion en endpoint legacy. Verifica BRAIN_API_KEY");
      }
      logServer("warn", "Brain /api/v1/brain/decide respondió con error", {
        target_url: legacyUrl,
        timeout_ms: BRAIN_TIMEOUT_MS,
        status: res.status,
        body: text.slice(0, 200),
      });
      incDoctorChatFetchFailed("legacy_decide", `http_${res.status}`);
      registerConsecutiveFailure({
        endpoint: "legacy_decide",
        reason: `http_${res.status}`,
        targetUrl: legacyUrl,
        timeoutMs: BRAIN_TIMEOUT_MS,
      });
      return null;
    }

    const data = (await res.json()) as BrainDecideResponse;
    registerSuccessIfRecovered();
    return data;
  } catch (err) {
    if (err instanceof BrainAuthError) {
      logServer("error", "brain.auth.failed", {
        target_url: `${BRAIN_API_URL}/orchestrate`,
        message: err.message,
      });
      return null;
    }

    if (err instanceof Error && err.name === "AbortError") {
      incDoctorChatFetchFailed("orchestrate", "timeout");
      registerConsecutiveFailure({
        endpoint: "orchestrate",
        reason: "timeout",
        targetUrl: `${BRAIN_API_URL}/orchestrate`,
        timeoutMs: BRAIN_TIMEOUT_MS,
      });
      logServer("warn", "Brain /decide timeout — usando fallback local", {
        target_url: `${BRAIN_API_URL}/orchestrate`,
        timeout_ms: BRAIN_TIMEOUT_MS,
      });
    } else {
      const errMeta = normalizeFetchError(err);
      incDoctorChatFetchFailed("orchestrate", errMeta.code);
      registerConsecutiveFailure({
        endpoint: "orchestrate",
        reason: errMeta.code,
        targetUrl: `${BRAIN_API_URL}/orchestrate`,
        timeoutMs: BRAIN_TIMEOUT_MS,
      });
      logServerError("Brain /decide no disponible — usando fallback local", err, {
        target_url: `${BRAIN_API_URL}/orchestrate`,
        timeout_ms: BRAIN_TIMEOUT_MS,
        error_code: errMeta.code,
        error_cause: errMeta.cause,
      });
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
