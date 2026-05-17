import { prisma } from "@/lib/prisma";
import { type MetaBrainDecision, type MetaBrainSource } from "@/lib/metabrain";
import { callBrainDecide } from "@/lib/brain-client";
import { callGroqDoctorChat } from "@/lib/groq-doctor-chat";
import { logFunctionalAudit } from "@/lib/audit-functional";
import { publishMetaBrainSignal } from "@/lib/metabrain-bridge";
import { logServer } from "@/lib/server-logger";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { incDoctorChatFallback } from "@/lib/observability/metrics";
import { loadDoctorContext } from "@/lib/doctor-context";
import { buildMedicalConversationMemory } from "@/lib/medical-conversation-memory";
import { buildMedicalReasoningContext } from "@/lib/medical-reasoning";
import { buildMedicalSpecialtyProtocolContext } from "@/lib/medical-specialty-protocols";
import { buildMedicalRuntimeContext } from "@/lib/medical-runtime-context";
import { buildMedicalWebRetrievalContext } from "@/lib/medical-web-retrieval";
import { DOCTOR_CHAT_PARAMS } from "@/chat/doctor-chat-params";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

type DoctorChatContextInput = {
  patient_id?: string;
  appointment_id?: string;
  patient_notes?: string | null;
  recent_history?: Array<{
    id: string;
    datetime: string;
    status: string;
    notes?: string | null;
    doctor_name?: string | null;
  }>;
  clinical_state?: string | null;
  metadata?: Record<string, unknown>;
};

type DoctorChatRequest = {
  doctorId: string;
  message: string;
  context?: DoctorChatContextInput;
  actorUserId?: string | null;
};

type ChatHistoryEntry = {
  id: string;
  doctor_message: string;
  response: string;
  confidence: number;
  source: MetaBrainSource;
  action: string;
  created_at: string;
};

type ChatSessionEntry = {
  session_id: string;
  conversation_id: string;
  title: string;
  patient_id: string | null;
  appointment_id: string | null;
  message_count: number;
  updated_at: string;
};

type ScopedMemoryExchange = {
  id: string;
  conversationId: string;
  doctorMessage: string;
  assistantResponse: string;
  action: string;
  source: MetaBrainSource;
  createdAt: string;
};

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseIntegerEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeChatSessionId(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || null;
}

function normalizeChatRequestId(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120) || null;
}

function isDoctorChatClearAction(action: string | null | undefined): boolean {
  return action === DOCTOR_CHAT_PARAMS.clearAction || action === "doctor_chat.clear_requested";
}

function buildConversationId(
  doctorId: string,
  patientId?: string | null,
  appointmentId?: string | null,
  sessionId?: string | null,
): string {
  const base = `${DOCTOR_CHAT_PARAMS.conversationPrefix}:${doctorId}:patient:${patientId ?? "general"}:appointment:${appointmentId ?? "none"}`;
  return sessionId ? `${base}:chat:${sessionId}` : base;
}

function buildDoctorPatientConversationPrefix(doctorId: string, patientId?: string | null): string {
  const patientToken = patientId ?? "general";
  return `${DOCTOR_CHAT_PARAMS.conversationPrefix}:${doctorId}:patient:${patientToken}:appointment:`;
}

async function loadScopedDoctorMemoryExchanges(input: {
  tenantId: string;
  doctorId: string;
  patientId?: string | null;
}): Promise<ScopedMemoryExchange[]> {
  const memoryScope = String(process.env.DOCTOR_CHAT_MEMORY_SCOPE ?? "doctor")
    .trim()
    .toLowerCase();
  const basePrefix = `${DOCTOR_CHAT_PARAMS.conversationPrefix}:${input.doctorId}:`;
  const scopedPrefix = buildDoctorPatientConversationPrefix(input.doctorId, input.patientId);
  const prefix = memoryScope === "patient" ? scopedPrefix : basePrefix;
  const maxRows = parseIntegerEnv(process.env.DOCTOR_CHAT_MEMORY_MAX_AUDIT_ROWS, 1200, 100, 5000);
  const respectClear = parseBooleanEnv(process.env.DOCTOR_CHAT_MEMORY_RESPECT_CLEAR, true);
  
  const rows = await prisma.auditLog.findMany({
    where: {
      tenant_id: input.tenantId,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: { startsWith: prefix },
      action: { in: [DOCTOR_CHAT_PARAMS.exchangeAction, DOCTOR_CHAT_PARAMS.clearAction, "doctor_chat.clear_requested"] },
    },
    orderBy: { created_at: "desc" },
    take: maxRows,
  });

  logServer("debug", "doctor_chat.memory_load_start", {
    doctor_id: input.doctorId,
    patient_id: input.patientId ?? "general",
    conversation_prefix: prefix,
    total_rows_found: rows.length,
  });

  const latestClearByConversation = new Map<string, Date>();
  if (respectClear) {
    for (const row of rows) {
      if (!isDoctorChatClearAction(row.action)) continue;
      const conversationId = row.entity_id ?? "";
      if (!conversationId || latestClearByConversation.has(conversationId)) continue;
      latestClearByConversation.set(conversationId, row.created_at);
    }
  }

  const exchanges = rows
    .slice()
    .reverse()
    .filter((row) => row.action === DOCTOR_CHAT_PARAMS.exchangeAction)
    .filter((row) => {
      const conversationId = row.entity_id ?? "";
      if (!conversationId) return false;
      const latestClear = latestClearByConversation.get(conversationId);
      return !latestClear || row.created_at > latestClear;
    })
    .map((row) => {
      const before = row.payload_before as Record<string, unknown> | null;
      const after = row.payload_after as Record<string, unknown> | null;
      return {
        id: row.id,
        conversationId: row.entity_id ?? "",
        doctorMessage: String(before?.message ?? ""),
        assistantResponse: String(after?.response ?? ""),
        action: String(after?.action ?? "GUIDE_NEXT_STEP"),
        source: normalizeMetaBrainSource(String(after?.source ?? "RULES")),
        createdAt: row.created_at.toISOString(),
      };
    });

  const result = exchanges.slice(-parseIntegerEnv(process.env.DOCTOR_CHAT_MEMORY_MAX_EXCHANGES, 240, 20, 1200));
  
  logServer("info", "doctor_chat.memory_load_complete", {
    doctor_id: input.doctorId,
    patient_id: input.patientId ?? "general",
    total_exchanges_after_filter: result.length,
    exchanges_sample: result.slice(0, 2).map((e) => ({
      doctor_msg: e.doctorMessage.slice(0, 100),
      assistant_msg: e.assistantResponse.slice(0, 100),
    })),
  });

  return result;
}

async function findCompletedDoctorChatByRequestId(input: {
  tenantId: string;
  conversationId: string;
  requestId: string;
}): Promise<MetaBrainDecision | null> {
  const latestClear = await prisma.auditLog.findFirst({
    where: {
      tenant_id: input.tenantId,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: input.conversationId,
      action: { in: [DOCTOR_CHAT_PARAMS.clearAction, "doctor_chat.clear_requested"] },
    },
    orderBy: { created_at: "desc" },
    select: { created_at: true },
  });
  const rows = await prisma.auditLog.findMany({
    where: {
      tenant_id: input.tenantId,
      action: DOCTOR_CHAT_PARAMS.exchangeAction,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: input.conversationId,
      ...(latestClear ? { created_at: { gt: latestClear.created_at } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: 25,
  });

  for (const row of rows) {
    const before = row.payload_before as Record<string, unknown> | null;
    const after = row.payload_after as Record<string, unknown> | null;
    if (normalizeChatRequestId(before?.request_id) !== input.requestId || !after) continue;

    return {
      action: String(after.action ?? "GUIDE_NEXT_STEP"),
      response: String(after.response ?? ""),
      confidence: Number(after.confidence ?? 0),
      source: normalizeMetaBrainSource(String(after.source ?? "RULES")),
    };
  }

  return null;
}

async function resolveClinicalContext(doctorId: string, context?: DoctorChatContextInput) {
  const tenantId = getTenantIdFromContext() ?? "default";
  let appointmentId = context?.appointment_id?.trim() || undefined;
  let patientId = context?.patient_id?.trim() || undefined;

  const appointment = appointmentId
    ? await prisma.appointment.findFirst({
        where: { id: appointmentId, tenant_id: tenantId, doctor_id: doctorId, deleted_at: null },
        include: { patient: true },
      })
    : null;

  if (appointment) {
    appointmentId = appointment.id;
    patientId = patientId ?? appointment.patient_id;
  }

  const patient = patientId
    ? await prisma.patient.findFirst({
        where: { id: patientId, tenant_id: tenantId },
        select: { id: true, name: true, phone: true, notes: true },
      })
    : null;

  const historyRows = patientId
    ? await prisma.appointment.findMany({
        where: { tenant_id: tenantId, patient_id: patientId, deleted_at: null },
        include: { doctor: { include: { user: { select: { name: true } } } } },
        orderBy: { datetime: "desc" },
        take: 8,
      })
    : [];

  const sessionId = normalizeChatSessionId(context?.metadata?.[DOCTOR_CHAT_PARAMS.sessionMetadataKey]);
  const conversationId = buildConversationId(doctorId, patient?.id ?? patientId, appointmentId, sessionId);
  const latestClear = await prisma.auditLog.findFirst({
    where: {
      tenant_id: tenantId,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: conversationId,
      action: { in: [DOCTOR_CHAT_PARAMS.clearAction, "doctor_chat.clear_requested"] },
    },
    orderBy: { created_at: "desc" },
    select: { created_at: true },
  });
  const conversationHistory = await prisma.auditLog.findMany({
    where: {
      tenant_id: tenantId,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: conversationId,
      action: DOCTOR_CHAT_PARAMS.exchangeAction,
      ...(latestClear ? { created_at: { gt: latestClear.created_at } } : {}),
    },
    orderBy: { created_at: "asc" },
    take: 10,
  });
  const memoryExchanges = await loadScopedDoctorMemoryExchanges({
    tenantId,
    doctorId,
    patientId: patient?.id ?? patientId ?? null,
  });

  return {
    conversationId,
    patient,
    appointment,
    recentHistory: historyRows.map((row) => ({
      id: row.id,
      datetime: row.datetime.toISOString(),
      status: row.status,
      notes: row.notes,
      doctor_name: row.doctor.user.name,
    })),
    conversationHistory: conversationHistory.map((row) => ({
      doctor_message: String((row.payload_before as Record<string, unknown> | null)?.message ?? ""),
      response: String((row.payload_after as Record<string, unknown> | null)?.response ?? ""),
      confidence: Number((row.payload_after as Record<string, unknown> | null)?.confidence ?? 0),
      source: String((row.payload_after as Record<string, unknown> | null)?.source ?? "RULES") as MetaBrainSource,
      action: String((row.payload_after as Record<string, unknown> | null)?.action ?? "GUIDE_NEXT_STEP"),
      created_at: row.created_at.toISOString(),
    })),
    memoryExchanges,
    clinicalState:
      context?.clinical_state?.trim() ||
      context?.patient_notes?.trim() ||
      appointment?.notes?.trim() ||
      patient?.notes?.trim() ||
      null,
    metadata: context?.metadata ?? {},
  };
}

function formatHistory(entries: ChatHistoryEntry[]) {
  return entries.flatMap((entry) => [
    {
      id: `${entry.id}:doctor`,
      role: "doctor" as const,
      content: entry.doctor_message,
      created_at: entry.created_at,
    },
    {
      id: `${entry.id}:metabrain`,
      role: "metabrain" as const,
      content: entry.response,
      created_at: entry.created_at,
      confidence: entry.confidence,
      source: entry.source,
    },
  ]);
}

function normalizeMetaBrainSource(source: string | null | undefined): MetaBrainSource {
  if (source === "ML" || source === "RULES" || source === "DL" || source === "GROQ") return source;
  return "ML";
}

function normalizeForMatch(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isStructuredClinicalAuditQuery(message: string): boolean {
  const normalized = normalizeForMatch(message);
  const hasCaseTag = normalized.includes("<caso_clinico") || normalized.includes("<mision>");
  const hasPharmaSignals =
    normalized.includes("sertralina") ||
    normalized.includes("sumatriptan") ||
    normalized.includes("isrs") ||
    normalized.includes("sindrome serotoninergico");
  return hasCaseTag || hasPharmaSignals;
}

function isClinicallyGroundedResponse(query: string, response: string): boolean {
  const q = normalizeForMatch(query);
  const r = normalizeForMatch(response);

  if (q.includes("sertralina") && !r.includes("sertralina")) return false;
  if (q.includes("sumatriptan") && !r.includes("sumatriptan")) return false;

  const requiresInteractionCheck =
    q.includes("isrs") ||
    q.includes("sumatriptan") ||
    q.includes("sindrome serotoninergico") ||
    q.includes("combinacion");

  if (!requiresInteractionCheck) return true;

  return (
    r.includes("riesgo") ||
    r.includes("interaccion") ||
    r.includes("serotoninergico") ||
    r.includes("bloque") ||
    r.includes("contraind")
  );
}

function hasClinicalIntent(message: string): boolean {
  const normalized = normalizeForMatch(message);
  return [
    "dolor",
    "fiebre",
    "paciente",
    "dosis",
    "tratamiento",
    "presion",
    "tension",
    "migra",
    "farmaco",
    "medic",
    "diagnost",
    "sintoma",
    "hora",
    "fecha",
    "clini",
  ].some((token) => normalized.includes(token));
}

function isLowSignalInput(message: string): boolean {
  const normalized = normalizeForMatch(message).replace(/\s+/g, " ").trim();
  if (!normalized) return true;
  if (normalized.length <= 2) return true;
  if (hasClinicalIntent(normalized)) return false;

  const compact = normalized.replace(/[^a-z0-9]/g, "");
  if (!compact) return true;
  const hasLongConsonantRun = /[bcdfghjklmnpqrstvwxyz]{6,}/.test(compact);
  const vowelMatches = compact.match(/[aeiou]/g);
  const vowelRatio = (vowelMatches?.length ?? 0) / Math.max(1, compact.length);
  return hasLongConsonantRun || (compact.length >= 10 && vowelRatio < 0.15);
}

function isOverTemplatedClarification(response: string): boolean {
  const normalized = normalizeForMatch(response);
  return (
    normalized.includes("analizando lo que mencionas") ||
    normalized.includes("necesito un poco mas de informacion") ||
    normalized.includes("contame si hay algun otro sintoma") ||
    normalized.includes("podemos ajustar esto con mas informacion")
  );
}

function sanitizeDoctorChatResponse(response: string): string {
  const cleaned = String(response ?? "")
    .replace(/\r/g, "")
    // Markdown headings -> plain title
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    // Bold/italic markers
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    // Bullet normalization
    .replace(/(^|\n)\s*[\*\u2022]\s+/g, "$1- ")
    // Remove LaTeX block delimiters
    .replace(/\$\$[\s\S]*?\$\$/g, "")
    // Inline LaTeX delimiters \( ... \), \[ ... \]
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/g, "$1")
    // Common latex escapes
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\cdot/g, "·")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
    .replace(/\\_/g, "_")
    // Compact spacing
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

async function syncDoctorChatLearningToMbChat(input: {
  doctorId: string;
  message: string;
  response: string;
  conversationId: string;
  patientId?: string | null;
  appointmentId?: string | null;
  clinicalState?: string | null;
}): Promise<void> {
  const apiBaseUrl = String(process.env.API_BASE_URL ?? "http://api:8000").replace(/\/$/, "");
  const apiKey = (
    process.env.METABRAIN_API_KEY ??
    process.env.BRAIN_API_KEY ??
    process.env.INTERNAL_SERVICES_KEY ??
    ""
  ).trim();
  if (!apiBaseUrl || !apiKey) return;

  const controller = new AbortController();
  const timeoutMs = 3000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const teachingResponse = await fetch(`${apiBaseUrl}/api/v1/admin/lessons/${encodeURIComponent(input.doctorId)}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-internal-key": apiKey,
      },
      body: JSON.stringify({
        pattern: String(input.message ?? "").slice(0, 200),
        correct_action: String(input.response ?? "").slice(0, 500) || "Correccion clinica del medico",
        category: "flow",
      }),
    });

    if (teachingResponse.ok || teachingResponse.status === 409) {
      logServer("info", "doctor_chat.mb_chat_learning_sync_ok", {
        conversation_id: input.conversationId,
        mode: "api_internal_lessons",
        duplicate: teachingResponse.status === 409,
      });
      return;
    }

    const teachingBody = await teachingResponse.text().catch(() => "");
    logServer("warn", "doctor_chat.mb_chat_learning_sync_failed", {
      conversation_id: input.conversationId,
      mode: "api_internal_lessons",
      status: teachingResponse.status,
      response: teachingBody.slice(0, 400),
    });
  } catch (error) {
    logServer("warn", "doctor_chat.mb_chat_learning_sync_failed", {
      conversation_id: input.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
}

function persistDoctorChatLearningJsonl(input: {
  doctorId: string;
  message: string;
  response: string;
  conversationId: string;
  patientId?: string | null;
  appointmentId?: string | null;
}): void {
  try {
    const storagePath = (
      process.env.MEDICAL_CHAT_LEARNING_PATH?.trim() ||
      "/app/artifacts/mb-chat-learning/medical-chat-learning.jsonl"
    );

    mkdirSync(dirname(storagePath), { recursive: true });

    const row = {
      id: `doctor-chat-${Date.now()}`,
      recordedAt: new Date().toISOString(),
      source: "doctor_chat_frontend",
      doctorId: input.doctorId,
      conversationId: input.conversationId,
      patientId: input.patientId ?? null,
      appointmentId: input.appointmentId ?? null,
      userMessage: String(input.message ?? "").slice(0, 2000),
      assistantResponse: String(input.response ?? "").slice(0, 4000),
    };

    appendFileSync(storagePath, `${JSON.stringify(row)}\n`, "utf8");
  } catch (error) {
    logServer("warn", "doctor_chat.local_jsonl_persist_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getDoctorChatHistory(input: {
  doctorId: string;
  context?: DoctorChatContextInput;
}) {
  const tenantId = getTenantIdFromContext() ?? "default";
  const resolved = await resolveClinicalContext(input.doctorId, input.context);
  const rows = await prisma.auditLog.findMany({
    where: {
      tenant_id: tenantId,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: resolved.conversationId,
      action: { in: [DOCTOR_CHAT_PARAMS.exchangeAction, DOCTOR_CHAT_PARAMS.clearAction, "doctor_chat.clear_requested"] },
    },
    orderBy: { created_at: "asc" },
    take: 25,
  });
  const latestClearAt = rows.reduce<Date | null>((latest, row) => {
    if (!isDoctorChatClearAction(row.action)) return latest;
    if (!latest || row.created_at > latest) return row.created_at;
    return latest;
  }, null);

  const entries: ChatHistoryEntry[] = rows
    .filter((row) => row.action === DOCTOR_CHAT_PARAMS.exchangeAction)
    .filter((row) => !latestClearAt || row.created_at > latestClearAt)
    .map((row) => ({
      id: row.id,
      doctor_message: String((row.payload_before as Record<string, unknown> | null)?.message ?? ""),
      response: String((row.payload_after as Record<string, unknown> | null)?.response ?? ""),
      confidence: Number((row.payload_after as Record<string, unknown> | null)?.confidence ?? 0),
      source: String((row.payload_after as Record<string, unknown> | null)?.source ?? "RULES") as MetaBrainSource,
      action: String((row.payload_after as Record<string, unknown> | null)?.action ?? "GUIDE_NEXT_STEP"),
      created_at: row.created_at.toISOString(),
    }));

  return {
    conversation_id: resolved.conversationId,
    messages: formatHistory(entries),
  };
}

function parseConversationId(conversationId: string): {
  patient_id: string | null;
  appointment_id: string | null;
  session_id: string;
} {
  const match = conversationId.match(/^doctor:[^:]+:patient:([^:]+):appointment:([^:]+)(?::chat:([^:]+))?$/);
  return {
    patient_id: match?.[1] && match[1] !== "general" ? match[1] : null,
    appointment_id: match?.[2] && match[2] !== "none" ? match[2] : null,
    session_id: match?.[3] ?? "default",
  };
}

export async function listDoctorChatSessions(input: { doctorId: string }): Promise<{ sessions: ChatSessionEntry[] }> {
  const tenantId = getTenantIdFromContext() ?? "default";
  const rows = await prisma.auditLog.findMany({
    where: {
      tenant_id: tenantId,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: {
        startsWith: `${DOCTOR_CHAT_PARAMS.conversationPrefix}:${input.doctorId}:`,
      },
      action: { in: [DOCTOR_CHAT_PARAMS.exchangeAction, DOCTOR_CHAT_PARAMS.clearAction, "doctor_chat.clear_requested"] },
    },
    orderBy: { created_at: "desc" },
    take: 200,
  });

  const sessions = new Map<string, ChatSessionEntry>();
  const clearedAt = new Map<string, Date>();

  for (const row of rows) {
    const conversationId = row.entity_id ?? "";
    if (!conversationId) continue;
    if (isDoctorChatClearAction(row.action)) {
      const previous = clearedAt.get(conversationId);
      if (!previous || row.created_at > previous) clearedAt.set(conversationId, row.created_at);
      continue;
    }
    if (row.action !== DOCTOR_CHAT_PARAMS.exchangeAction) continue;
    const latestClear = clearedAt.get(conversationId);
    if (latestClear && row.created_at <= latestClear) continue;

    const parsed = parseConversationId(conversationId);
    const message = String((row.payload_before as Record<string, unknown> | null)?.message ?? "").trim();
    const existing = sessions.get(conversationId);

    if (existing) {
      existing.message_count += 1;
      if (!existing.title && message) existing.title = message;
      continue;
    }

    sessions.set(conversationId, {
      session_id: parsed.session_id,
      conversation_id: conversationId,
      title: message ? (message.length > 54 ? `${message.slice(0, 51).trim()}...` : message) : "Chat sin titulo",
      patient_id: parsed.patient_id,
      appointment_id: parsed.appointment_id,
      message_count: 1,
      updated_at: row.created_at.toISOString(),
    });
  }

  return {
    sessions: Array.from(sessions.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    ),
  };
}

export async function clearDoctorChatHistory(input: {
  doctorId: string;
  context?: DoctorChatContextInput;
  actorUserId?: string | null;
}) {
  const tenantId = getTenantIdFromContext() ?? "default";
  const resolved = await resolveClinicalContext(input.doctorId, input.context);
  const latestClear = await prisma.auditLog.findFirst({
    where: {
      tenant_id: tenantId,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: resolved.conversationId,
      action: { in: [DOCTOR_CHAT_PARAMS.clearAction, "doctor_chat.clear_requested"] },
    },
    orderBy: { created_at: "desc" },
    select: { created_at: true },
  });

  const existingCount = await prisma.auditLog.count({
    where: {
      tenant_id: tenantId,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: resolved.conversationId,
      action: DOCTOR_CHAT_PARAMS.exchangeAction,
      ...(latestClear ? { created_at: { gt: latestClear.created_at } } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      tenant_id: tenantId,
      user_id: input.actorUserId ?? input.doctorId,
      action: "doctor_chat.clear_requested",
      action_type: "UPDATE",
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: resolved.conversationId,
        metadata_json: {
          operation: "clear_requested",
          preserved_history: true,
          previous_message_count: existingCount,
        },
    },
  });

  await logFunctionalAudit({
    userId: input.actorUserId ?? input.doctorId,
    action: DOCTOR_CHAT_PARAMS.clearAction,
    entityId: resolved.conversationId,
    entityType: DOCTOR_CHAT_PARAMS.auditEntityType,
    payloadBefore: {
      doctor_id: input.doctorId,
      deleted_count: existingCount,
      previous_message_count: existingCount,
    },
    payloadAfter: {
      cleared: true,
      marker_written: true,
      deleted_count: existingCount,
    },
  });

  logServer("info", "doctor_chat.cleared", {
    doctor_id: input.doctorId,
    conversation_id: resolved.conversationId,
    deleted_count: existingCount,
    previous_message_count: existingCount,
  });

  return {
    conversation_id: resolved.conversationId,
    deleted_count: existingCount,
    marker_written: true,
  };
}

export async function handleDoctorChat(
  input: DoctorChatRequest,
): Promise<MetaBrainDecision & { conversation_id: string; degraded: boolean }> {
  const tenantId = getTenantIdFromContext() ?? "default";
  const resolved = await resolveClinicalContext(input.doctorId, input.context);
  const requestId = normalizeChatRequestId(resolved.metadata?.chat_request_id);
  const normalizedMessage = String(input.message ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hasHora = /\bhora\b/.test(normalizedMessage);
  const hasFecha = /\bfecha\b/.test(normalizedMessage) || /\bdia\b/.test(normalizedMessage);
  const isWeatherQuery = /\b(clima|tiempo|temperatura|lluvia|viento|humedad)\b/.test(normalizedMessage);
  const isDateTimeQuery =
    (hasHora && hasFecha) ||
    (normalizedMessage.length <= 40 && (hasHora || hasFecha)) ||
    /\b(que|cual)\s+(fecha|hora)\s+es\b/.test(normalizedMessage);

  if (requestId) {
    const existingDecision = await findCompletedDoctorChatByRequestId({
      tenantId,
      conversationId: resolved.conversationId,
      requestId,
    });
    if (existingDecision) {
      logServer("info", "doctor_chat.idempotent_replay", {
        doctor_id: input.doctorId,
        conversation_id: resolved.conversationId,
        request_id: requestId,
      });
      return {
        ...existingDecision,
        conversation_id: resolved.conversationId,
        degraded: false,
      };
    }
  }

  const medicalRuntimeContext = await buildMedicalRuntimeContext({
    tenantId,
    doctorUserId: input.actorUserId ?? input.doctorId,
    conversationId: resolved.conversationId,
    message: input.message,
  });

  const medicalConversationMemory = await buildMedicalConversationMemory({
    tenantId,
    doctorUserId: input.actorUserId ?? input.doctorId,
    conversationId: resolved.conversationId,
    patientId: resolved.patient?.id ?? null,
    appointmentId: resolved.appointment?.id ?? null,
    currentMessage: input.message,
    exchanges: resolved.memoryExchanges.map((entry) => ({
      id: entry.id,
      doctorMessage: entry.doctorMessage,
      assistantResponse: entry.assistantResponse,
      action: entry.action,
      source: entry.source,
      createdAt: entry.createdAt,
    })),
  });

  const medicalWebRetrieval = await buildMedicalWebRetrievalContext({
    tenantId,
    doctorUserId: input.actorUserId ?? input.doctorId,
    conversationId: resolved.conversationId,
    message: input.message,
    clinicalState: resolved.clinicalState,
  });
  const doctorProfileContext = await loadDoctorContext({
    tenantId,
    doctorUserId: input.actorUserId ?? input.doctorId,
    metadata: resolved.metadata,
    hasRetrievalEvidence: Boolean(medicalWebRetrieval?.sources.length),
    hasRuntimeContext: Boolean(medicalRuntimeContext),
  });
  const medicalReasoning = buildMedicalReasoningContext({
    message: input.message,
    clinicalState: resolved.clinicalState,
    hasRetrievalEvidence: Boolean(medicalWebRetrieval?.sources.length),
    hasPatientContext: Boolean(resolved.patient || resolved.appointment || resolved.clinicalState),
  });
  const medicalSpecialtyProtocol = buildMedicalSpecialtyProtocolContext({
    message: input.message,
    clinicalState: resolved.clinicalState,
    hasRetrievalEvidence: Boolean(medicalWebRetrieval?.sources.length),
    hasRuntimeContext: Boolean(medicalRuntimeContext),
  });

  const sharedContext = {
    doctor_id: input.doctorId,
    patient: resolved.patient,
    current_appointment: resolved.appointment
      ? {
          id: resolved.appointment.id,
          datetime: resolved.appointment.datetime.toISOString(),
          status: resolved.appointment.status,
          notes: resolved.appointment.notes,
        }
      : null,
    recent_history: input.context?.recent_history?.length ? input.context.recent_history : resolved.recentHistory,
    conversation_history: resolved.conversationHistory,
    clinical_state: resolved.clinicalState,
    metadata: safeJson({
      ...resolved.metadata,
      conversation_id: resolved.conversationId,
      ...(medicalConversationMemory ? { medical_conversation_memory: medicalConversationMemory } : {}),
      ...(medicalRuntimeContext ? { medical_runtime_context: medicalRuntimeContext } : {}),
      ...(medicalWebRetrieval ? { medical_web_retrieval: medicalWebRetrieval } : {}),
      doctor_profile_context: doctorProfileContext,
      ...(medicalReasoning ? { medical_reasoning: medicalReasoning } : {}),
      ...(medicalSpecialtyProtocol ? { medical_specialty_protocol: medicalSpecialtyProtocol } : {}),
    }),
  };

  const forcedDateTimeDecision: MetaBrainDecision | null = (() => {
    if (!isDateTimeQuery) return null;
    const timezone = String(process.env.MEDICAL_RUNTIME_CONTEXT_TIMEZONE ?? "America/Argentina/Buenos_Aires").trim() || "America/Argentina/Buenos_Aires";
    const now = new Date();
    const dateText = new Intl.DateTimeFormat("es-AR", {
      timeZone: timezone,
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const timeText = new Intl.DateTimeFormat("es-AR", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    const response = [
      "Fecha y hora en tiempo real:",
      `Fecha: ${dateText}`,
      `Hora: ${timeText}`,
      `Zona horaria: ${timezone}`,
    ].join("\n");
    return {
      action: "DOCTOR_CHAT_DATETIME_REALTIME",
      response,
      confidence: 1,
      source: "RULES",
    };
  })();

  const forcedWeatherDecision: MetaBrainDecision | null = (() => {
    if (!isWeatherQuery) return null;
    const weather = medicalRuntimeContext?.weather;
    if (!weather) {
      return {
        action: "DOCTOR_CHAT_WEATHER_UNAVAILABLE",
        response: "No tengo datos meteorologicos en este momento para responder con precision.",
        confidence: 0.6,
        source: "RULES",
      };
    }

    const lines = [
      "Clima actual (contexto operativo):",
      weather.region ? `Region: ${weather.region}` : undefined,
      weather.condition ? `Condicion: ${weather.condition}` : undefined,
      typeof weather.temperatureC === "number" ? `Temperatura: ${weather.temperatureC} C` : undefined,
      typeof weather.relativeHumidityPercent === "number" ? `Humedad: ${weather.relativeHumidityPercent}%` : undefined,
      typeof weather.pressureHPa === "number" ? `Presion: ${weather.pressureHPa} hPa` : undefined,
      weather.observedAt ? `Observado: ${weather.observedAt}` : undefined,
      "Fuente: open-meteo",
    ].filter(Boolean);

    return {
      action: "DOCTOR_CHAT_WEATHER_RUNTIME",
      response: lines.join("\n"),
      confidence: 0.95,
      source: "RULES",
    };
  })();

  const forcedDecision = forcedDateTimeDecision ?? forcedWeatherDecision;

  const groqResult = forcedDecision
    ? null
    : await callGroqDoctorChat({
        role: "DOCTOR",
        message: input.message,
        context: sharedContext,
      });

  const brainResult = forcedDecision || groqResult
    ? null
    : await callBrainDecide({
        role: "DOCTOR",
        message: input.message,
        // Contrato conversacional obligatorio: aísla el médico del pipeline de triage.
        // INVARIANT A: doctor_professional NUNCA entra a triage automático.
        assistant_mode: "doctor_professional",
        actor_role: "doctor",
        context: sharedContext,
      });

  const degraded = !forcedDateTimeDecision && !groqResult && !brainResult;

  const decision: MetaBrainDecision = forcedDecision
    ? forcedDecision
    : groqResult
    ? groqResult
    : brainResult
    ? {
        action: brainResult.action,
        response: brainResult.response,
        confidence: brainResult.confidence,
        source: normalizeMetaBrainSource(brainResult.source),
      }
    : {
        action: "DOCTOR_CHAT_SAFE_BLOCK",
        response: "No puedo generar una respuesta clinica segura con los datos y servicios disponibles en este momento. Reintentar en unos segundos o escalar para revision clinica manual.",
        confidence: 0.2,
        source: "RULES",
      };

  if (isStructuredClinicalAuditQuery(input.message) && !isClinicallyGroundedResponse(input.message, decision.response)) {
    const strictClinicalGuard = parseBooleanEnv(process.env.DOCTOR_CHAT_STRICT_CLINICAL_GUARD, false);
    if (strictClinicalGuard) {
      decision.action = "DOCTOR_CHAT_CLINICAL_VALIDATION_BLOCK";
      decision.response = "La respuesta automatica no paso validacion clinica minima para este caso farmacologico. Bloqueo preventivo activado: revisar interaccion de farmacos, riesgo de sindrome serotoninergico y definir alternativa terapeutica segura.";
      decision.confidence = Math.min(decision.confidence, 0.25);
      decision.source = "RULES";
    }
  }

  if (!isStructuredClinicalAuditQuery(input.message)) {
    const relaxedMode = parseBooleanEnv(process.env.DOCTOR_CHAT_RELAXED_MODE, true);
    const lowSignalInput = isLowSignalInput(input.message);
    if (!relaxedMode && (lowSignalInput || isOverTemplatedClarification(decision.response))) {
      decision.action = "DOCTOR_CHAT_INPUT_CLARIFICATION";
      decision.response =
        "No pude interpretar el mensaje con precision clinica. Escribi la consulta en una frase clara, por ejemplo: sintoma principal, tiempo de evolucion y tratamiento actual.";
      decision.confidence = Math.min(decision.confidence, 0.35);
      decision.source = "RULES";
    }
  }

  decision.response = sanitizeDoctorChatResponse(decision.response);

  if (degraded) {
    incDoctorChatFallback("brain_unavailable");
  }

  await logFunctionalAudit({
    userId: input.actorUserId ?? input.doctorId,
    action: DOCTOR_CHAT_PARAMS.exchangeAction,
    entityId: resolved.conversationId,
    entityType: DOCTOR_CHAT_PARAMS.auditEntityType,
    payloadBefore: {
      request_id: requestId,
      doctor_id: input.doctorId,
      message: input.message,
      context: safeJson({
        patient_id: resolved.patient?.id ?? null,
        appointment_id: resolved.appointment?.id ?? null,
        clinical_state: resolved.clinicalState,
        recent_history: input.context?.recent_history?.length ? input.context.recent_history : resolved.recentHistory,
      }),
    },
    payloadAfter: safeJson(decision),
  });

  await publishMetaBrainSignal({
    event: DOCTOR_CHAT_PARAMS.completedEvent,
    details: {
      doctor_id: input.doctorId,
      patient_id: resolved.patient?.id ?? null,
      appointment_id: resolved.appointment?.id ?? null,
      confidence: decision.confidence,
      source: decision.source,
      action: decision.action,
    },
  });

  logServer("info", "doctor_chat.completed", {
    doctor_id: input.doctorId,
    conversation_id: resolved.conversationId,
    confidence: decision.confidence,
    source: decision.source,
    action: decision.action,
    degraded,
  });

  void syncDoctorChatLearningToMbChat({
    doctorId: input.doctorId,
    message: input.message,
    response: decision.response,
    conversationId: resolved.conversationId,
    patientId: resolved.patient?.id ?? null,
    appointmentId: resolved.appointment?.id ?? null,
    clinicalState: resolved.clinicalState,
  });
  persistDoctorChatLearningJsonl({
    doctorId: input.doctorId,
    message: input.message,
    response: decision.response,
    conversationId: resolved.conversationId,
    patientId: resolved.patient?.id ?? null,
    appointmentId: resolved.appointment?.id ?? null,
  });

  return {
    ...decision,
    conversation_id: resolved.conversationId,
    degraded,
  };
}
