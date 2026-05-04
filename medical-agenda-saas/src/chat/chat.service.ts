import { prisma } from "@/lib/prisma";
import { metabrain, type MetaBrainDecision, type MetaBrainSource } from "@/lib/metabrain";
import { callBrainDecide } from "@/lib/brain-client";
import { callGroqDoctorChat } from "@/lib/groq-doctor-chat";
import { logFunctionalAudit } from "@/lib/audit-functional";
import { publishMetaBrainSignal } from "@/lib/metabrain-bridge";
import { logServer } from "@/lib/server-logger";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { incDoctorChatFallback } from "@/lib/observability/metrics";
import { DOCTOR_CHAT_PARAMS } from "@/chat/doctor-chat-params";

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

function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeChatSessionId(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || null;
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
  const conversationHistory = await prisma.auditLog.findMany({
    where: {
      tenant_id: tenantId,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: conversationId,
    },
    orderBy: { created_at: "asc" },
    take: 10,
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
    },
    orderBy: { created_at: "asc" },
    take: 25,
  });

  const entries: ChatHistoryEntry[] = rows.map((row) => ({
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
    },
    orderBy: { created_at: "desc" },
    take: 200,
  });

  const sessions = new Map<string, ChatSessionEntry>();

  for (const row of rows) {
    const conversationId = row.entity_id ?? "";
    if (!conversationId) continue;

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

  const existingCount = await prisma.auditLog.count({
    where: {
      tenant_id: tenantId,
      entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
      entity_id: resolved.conversationId,
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
      deleted_count: 0,
      previous_message_count: existingCount,
    },
    payloadAfter: {
      cleared: false,
      marker_written: true,
      deleted_count: 0,
    },
  });

  logServer("info", "doctor_chat.cleared", {
    doctor_id: input.doctorId,
    conversation_id: resolved.conversationId,
    deleted_count: 0,
    previous_message_count: existingCount,
  });

  return {
    conversation_id: resolved.conversationId,
    deleted_count: 0,
    marker_written: true,
  };
}

export async function handleDoctorChat(
  input: DoctorChatRequest,
): Promise<MetaBrainDecision & { conversation_id: string; degraded: boolean }> {
  const resolved = await resolveClinicalContext(input.doctorId, input.context);

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
    }),
  };

  const groqResult = await callGroqDoctorChat({
    role: "DOCTOR",
    message: input.message,
    context: sharedContext,
  });

  const brainResult = groqResult
    ? null
    : await callBrainDecide({
        role: "DOCTOR",
        message: input.message,
        context: sharedContext,
      });

  const degraded = !groqResult && !brainResult;

  const decision: MetaBrainDecision = groqResult
    ? groqResult
    : brainResult
    ? {
        action: brainResult.action,
        response: brainResult.response,
        confidence: brainResult.confidence,
        source: normalizeMetaBrainSource(brainResult.source),
      }
    : await metabrain.decide({
        role: "DOCTOR",
        message: input.message,
        context: sharedContext,
      });

  if (degraded) {
    incDoctorChatFallback("brain_unavailable");
  }

  await logFunctionalAudit({
    userId: input.actorUserId ?? input.doctorId,
    action: DOCTOR_CHAT_PARAMS.exchangeAction,
    entityId: resolved.conversationId,
    entityType: DOCTOR_CHAT_PARAMS.auditEntityType,
    payloadBefore: {
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

  return {
    ...decision,
    conversation_id: resolved.conversationId,
    degraded,
  };
}
