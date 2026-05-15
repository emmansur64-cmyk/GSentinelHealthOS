import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { clearDoctorChatHistory, getDoctorChatHistory, handleDoctorChat, listDoctorChatSessions } from "@/chat/chat.service";
import { DOCTOR_CHAT_PARAMS } from "@/chat/doctor-chat-params";

const contextSchema = z.object({
  patient_id: z.string().trim().uuid().optional(),
  appointment_id: z.string().trim().uuid().optional(),
  patient_notes: z.string().trim().max(4000).optional().nullable(),
  clinical_state: z.string().trim().max(4000).optional().nullable(),
  recent_history: z
    .array(
      z.object({
        id: z.string().trim(),
        datetime: z.string().trim(),
        status: z.string().trim(),
        notes: z.string().trim().optional().nullable(),
        doctor_name: z.string().trim().optional().nullable(),
      }),
    )
    .max(20)
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

const postSchema = z.object({
  doctor_id: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
  context: contextSchema.optional(),
}).strict();

const getSchema = z.object({
  doctor_id: z.string().trim().min(1).max(120),
  patient_id: z.string().trim().uuid().optional(),
  appointment_id: z.string().trim().uuid().optional(),
  session_id: z.string().trim().max(80).optional(),
  mode: z.enum(["history", "sessions"]).default("history"),
}).strict();

function canAccessDoctorChat(authUser: Awaited<ReturnType<typeof getAuthenticatedUser>>, doctorId: string) {
  if (!authUser) return false;
  if (hasRole(authUser, ["admin"])) return true;
  return authUser.userId === doctorId && hasRole(authUser, ["doctor", "medico"]);
}

export async function GET(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);

  const url = new URL(request.url);
  const parsed = getSchema.safeParse({
    doctor_id: url.searchParams.get("doctor_id") ?? undefined,
    patient_id: url.searchParams.get("patient_id") ?? undefined,
    appointment_id: url.searchParams.get("appointment_id") ?? undefined,
    session_id: url.searchParams.get("session_id") ?? undefined,
    mode: url.searchParams.get("mode") ?? undefined,
  });
  if (!parsed.success) return fail("Query invalida", 422, parsed.error.flatten());
  if (!canAccessDoctorChat(authUser, parsed.data.doctor_id)) return fail("Sin permisos", 403);

  if (parsed.data.mode === "sessions") {
    const sessions = await listDoctorChatSessions({
      doctorId: parsed.data.doctor_id,
    });
    return ok(sessions);
  }

  const history = await getDoctorChatHistory({
    doctorId: parsed.data.doctor_id,
    context: {
      patient_id: parsed.data.patient_id,
      appointment_id: parsed.data.appointment_id,
      metadata: parsed.data.session_id ? { [DOCTOR_CHAT_PARAMS.sessionMetadataKey]: parsed.data.session_id } : undefined,
    },
  });

  return ok(history);
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());
  if (!canAccessDoctorChat(authUser, parsed.data.doctor_id)) return fail("Sin permisos", 403);

  const result = await handleDoctorChat({
    doctorId: parsed.data.doctor_id,
    message: parsed.data.message,
    context: parsed.data.context,
    actorUserId: authUser.userId,
  });

  return ok({
    action: result.action,
    response: result.response,
    confidence: result.confidence,
    source: result.source,
    conversation_id: result.conversation_id,
    degraded: result.degraded,
  });
}

export async function DELETE(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);

  const url = new URL(request.url);
  const parsed = getSchema.safeParse({
    doctor_id: url.searchParams.get("doctor_id") ?? undefined,
    patient_id: url.searchParams.get("patient_id") ?? undefined,
    appointment_id: url.searchParams.get("appointment_id") ?? undefined,
    session_id: url.searchParams.get("session_id") ?? undefined,
    mode: url.searchParams.get("mode") ?? undefined,
  });

  if (!parsed.success) return fail("Query invalida", 422, parsed.error.flatten());
  if (!canAccessDoctorChat(authUser, parsed.data.doctor_id)) return fail("Sin permisos", 403);

  const result = await clearDoctorChatHistory({
    doctorId: parsed.data.doctor_id,
    context: {
      patient_id: parsed.data.patient_id,
      appointment_id: parsed.data.appointment_id,
      metadata: parsed.data.session_id ? { [DOCTOR_CHAT_PARAMS.sessionMetadataKey]: parsed.data.session_id } : undefined,
    },
    actorUserId: authUser.userId,
  });

  return ok(result);
}
