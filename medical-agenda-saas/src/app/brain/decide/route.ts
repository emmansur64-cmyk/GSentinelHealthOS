import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { metabrain } from "@/lib/metabrain";
import { callBrainDecide } from "@/lib/brain-client";

const requestSchema = z.object({
  role: z.literal("DOCTOR"),
  message: z.string().trim().min(1).max(4000),
  context: z.record(z.string(), z.unknown()).default({}),
}).strict();

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["doctor", "medico", "admin"])) return fail("Sin permisos", 403);

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

  const context = parsed.data.context;

  // ── Mapeamos el contexto al formato compartido con el Brain ──────────────
  const patient =
    context.patient && typeof context.patient === "object"
      ? {
          id: String((context.patient as Record<string, unknown>).id ?? ""),
          name: String((context.patient as Record<string, unknown>).name ?? ""),
          notes: String((context.patient as Record<string, unknown>).notes ?? "") || null,
        }
      : null;

  const currentAppointment =
    context.current_appointment && typeof context.current_appointment === "object"
      ? {
          id: String((context.current_appointment as Record<string, unknown>).id ?? ""),
          datetime: String(
            (context.current_appointment as Record<string, unknown>).datetime ??
              new Date().toISOString(),
          ),
          status: String(
            (context.current_appointment as Record<string, unknown>).status ?? "scheduled",
          ),
          notes:
            String((context.current_appointment as Record<string, unknown>).notes ?? "") || null,
        }
      : null;

  const conversationHistory = Array.isArray(context.conversation_history)
    ? (context.conversation_history as Record<string, unknown>[]).map((item) => ({
        doctor_message: String(item.doctor_message ?? ""),
        response: String(item.response ?? ""),
      }))
    : [];

  // ── 1. Intentar con el Brain Python real ─────────────────────────────────
  const brainResult = await callBrainDecide({
    role: parsed.data.role,
    message: parsed.data.message,
    context: {
      doctor_id: String(context.doctor_id ?? authUser.userId),
      patient,
      current_appointment: currentAppointment,
      recent_history: Array.isArray(context.recent_history)
        ? (context.recent_history as unknown[])
        : [],
      conversation_history: conversationHistory,
      clinical_state: String(context.clinical_state ?? "") || null,
      metadata: { source: "saas" },
    },
  });

  if (brainResult) {
    // Brain real disponible — devolver su respuesta normalizada
    return ok({
      action: brainResult.action,
      response: brainResult.response,
      confidence: brainResult.confidence,
      source: brainResult.source,
      model_version: brainResult.model_version,
      degraded: false,
    });
  }

  // ── 2. Fallback: MetaBrain local (TypeScript, reglas) ────────────────────
  const decision = await metabrain.decide({
    role: parsed.data.role,
    message: parsed.data.message,
    context: {
      doctor_id: String(context.doctor_id ?? authUser.userId),
      patient: patient
        ? {
            ...patient,
            phone: String((context.patient as Record<string, unknown>)?.phone ?? ""),
          }
        : null,
      current_appointment: currentAppointment,
      recent_history: Array.isArray(context.recent_history)
        ? (context.recent_history as Record<string, unknown>[]).map((item) => ({
            id: String(item.id ?? ""),
            datetime: String(item.datetime ?? new Date().toISOString()),
            status: String(item.status ?? "scheduled"),
            notes: String(item.notes ?? "") || null,
            doctor_name: String(item.doctor_name ?? "") || null,
          }))
        : [],
      conversation_history: Array.isArray(context.conversation_history)
        ? (context.conversation_history as Record<string, unknown>[]).map((item) => ({
            doctor_message: String(item.doctor_message ?? ""),
            response: String(item.response ?? ""),
            confidence: Number(item.confidence ?? 0),
            source: String(item.source ?? "RULES") as "ML" | "RULES" | "DL" | "GROQ",
            created_at: String(item.created_at ?? new Date().toISOString()),
          }))
        : [],
      clinical_state: String(context.clinical_state ?? "") || null,
      metadata: context,
    },
  });

  return ok({
    ...decision,
    degraded: true,
  });
}
