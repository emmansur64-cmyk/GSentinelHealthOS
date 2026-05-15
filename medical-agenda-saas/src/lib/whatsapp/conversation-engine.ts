import { prisma } from "@/lib/prisma";
import { logServer, logServerError } from "@/lib/server-logger";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { parseIntent, type Intent } from "@/lib/whatsapp/intent-parser";
import { checkRateLimit } from "@/lib/whatsapp/rate-limiter";
import { findNextAvailableSlot } from "@/lib/smart-schedule";
import { detectBlockingNegation } from "@/lib/nlp";
import { generateWhatsAppMetaBrainReply } from "@/lib/whatsapp/metabrain-assistant";
import {
  CONSULTATION_TYPE_DURATION,
  getConsultationDuration,
  normalizeConsultationType,
  type ConsultationType,
} from "@/lib/agenda/consultation-type";
import type { Prisma } from "@prisma/client";

type TipoConsulta = ConsultationType;

type ConversationContext = {
  doctor_id?: string;
  doctor_name?: string;
  patient_id?: string;
  proposed_time?: string;
  proposed_slot_end?: string;
  duration?: number;
  step?: string;
  specialty?: string;
  pending_appointment_id?: string;
  tipo_consulta?: TipoConsulta;
  last_metabrain_action?: string;
  last_metabrain_source?: string;
  last_metabrain_confidence?: number;
};

type ProcessResult = {
  reply: string;
  intent: Intent;
  action?: string;
};

const DEFAULT_DURATION = 30;

const TIPO_CONSULTA_DURATION: Record<TipoConsulta, number> = CONSULTATION_TYPE_DURATION;

const TIPO_CONSULTA_LABEL: Record<TipoConsulta, string> = {
  primera_vez: "Primera vez (45 min)",
  control: "Control (20 min)",
  urgencia: "Urgencia (15 min)",
};

function detectTipoConsulta(text: string): TipoConsulta {
  const normalized = normalizeConsultationType(text);
  if (normalized) return normalized;

  const t = text.toLowerCase();
  if (/primera\s*consulta/.test(t)) return "primera_vez";
  if (/urgente/.test(t)) return "urgencia";
  return "control";
}
const MENU_TEXT = `Hola! Soy el asistente de turnos. Puedo ayudarte con:

1. *Sacar turno* - Reservar un nuevo turno
2. *Mis turnos* - Consultar tus turnos
3. *Cancelar turno* - Cancelar un turno existente
4. *Reprogramar turno* - Cambiar fecha/hora

Escribi lo que necesites!`;

/**
 * Motor principal de procesamiento conversacional.
 * Recibe un message_id, ejecuta la lógica y responde vía WhatsApp.
 */
export async function processIncomingMessage(messageId: string): Promise<void> {
  // 1. Marcar como processing (idempotente: si ya no está pending, skip)
  let message;
  try {
    message = await prisma.incomingMessage.update({
      where: { message_id: messageId, status: "pending" },
      data: { status: "processing" },
    });
  } catch (error) {
    // P2025 = Record not found (ya procesado o no existe)
    if (
      typeof error === "object" && error !== null &&
      "code" in error && (error as { code: string }).code === "P2025"
    ) {
      logServer("info", "message.already_processed", { message_id: messageId });
      return;
    }
    throw error;
  }

  const phone = message.from_phone;
  const tenantId = message.tenant_id;
  const payload = message.payload_json as {
    text?: string;
    type?: string;
    contactName?: string;
    interactiveReplyId?: string;
  };
  const text = payload.text ?? "";

  try {
    // 2. Lock por usuario (advisory lock por phone)
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wa_user:${tenantId}:${phone}`}))`;

      // 3. Revalidar que no esté ya procesado
      const current = await tx.incomingMessage.findUnique({
        where: { message_id: messageId },
        select: { status: true },
      });
      if (current?.status !== "processing") {
        return null;
      }

      // 4. Rate limiting
      const allowed = await checkRateLimit(phone, tenantId);
      if (!allowed) {
        return {
          reply: "Estas enviando muchos mensajes. Espera un minuto e intenta de nuevo.",
          intent: "unknown" as Intent,
          action: "rate_limited",
        } satisfies ProcessResult;
      }

      // 5. Leer/crear contexto conversacional
      const state = await tx.conversationState.upsert({
        where: { tenant_id_phone: { tenant_id: tenantId, phone } },
        update: {},
        create: { tenant_id: tenantId, phone, context_json: {} },
      });

      const context = (state.context_json ?? {}) as ConversationContext;

      // 6. Procesar mensaje
      const processResult = await handleMessage(tx, tenantId, phone, text, context, payload);

      // 7. Actualizar contexto
      await tx.conversationState.update({
        where: { tenant_id_phone: { tenant_id: tenantId, phone } },
        data: {
          last_intent: processResult.intent,
          context_json: processResult.newContext ?? context,
        },
      });

      return processResult;
    });

    if (!result) return; // ya procesado

    // 8. Enviar respuesta via WhatsApp
    await sendWhatsAppMessage(phone, result.reply, tenantId);

    // 9. Marcar como done
    await prisma.incomingMessage.update({
      where: { message_id: messageId },
      data: { status: "done", processed_at: new Date() },
    });

    logServer("info", "message.processed", {
      message_id: messageId,
      phone,
      intent: result.intent,
      action: result.action ?? "reply",
    });
  } catch (error) {
    // Marcar como failed
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await prisma.incomingMessage.update({
      where: { message_id: messageId },
      data: { status: "failed", error: errorMsg.slice(0, 1000) },
    }).catch(() => { /* best effort */ });

    logServerError("message.processing.failed", error, {
      message_id: messageId,
      phone,
    });

    // Fallback: intentar enviar mensaje de error al usuario
    try {
      await sendWhatsAppMessage(phone, "Disculpa, tuve un problema procesando tu mensaje. Intenta de nuevo en unos minutos.", tenantId);
    } catch {
      // No propagar error secundario
    }

    throw error; // re-throw para que BullMQ maneje el retry
  }
}

// ─── Core dispatch ───────────────────────────────────────────────────────────

type HandleResult = ProcessResult & { newContext?: ConversationContext };

async function handleMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tenantId: string,
  phone: string,
  text: string,
  context: ConversationContext,
  payload: { interactiveReplyId?: string; contactName?: string },
): Promise<HandleResult> {
  // Si hay interactive reply, tratar como confirm/deny
  if (payload.interactiveReplyId) {
    if (payload.interactiveReplyId.startsWith("confirm_")) {
      return handleConfirmAppointment(tx, tenantId, phone, context);
    }
    if (payload.interactiveReplyId.startsWith("deny_")) {
      return {
        reply: "Entendido, turno cancelado. Te puedo ayudar con otra cosa?",
        intent: "deny",
        action: "denied",
        newContext: {},
      };
    }
  }

  const metabrainReply = await generateWhatsAppMetaBrainReply({
    tx,
    tenantId,
    phone,
    text,
    contactName: payload.contactName,
    context: context as Record<string, unknown>,
  });

  if (metabrainReply) {
    return {
      reply: metabrainReply.response,
      intent: "unknown",
      action: `metabrain:${metabrainReply.action}`,
      newContext: {
        ...context,
        last_metabrain_action: metabrainReply.action,
        last_metabrain_source: metabrainReply.source,
        last_metabrain_confidence: metabrainReply.confidence,
      },
    };
  }

  const parsed = parseIntent(text);

  // Detección de negaciones: bloquear ejecución si el usuario niega una acción crítica
  // Ejemplo: "no quiero cancelar" detectado como cancel_appointment debe ser bloqueado
  const negation = detectBlockingNegation(text, parsed.intent);
  if (negation.detected && negation.blockExecution) {
    logServer("info", "negation.detected", {
      phone,
      text,
      originalIntent: negation.originalIntent,
      pattern: negation.pattern,
    });
    return {
      reply: negation.suggestedReply ?? "Entendido. ¿Puedo ayudarte con algo más?",
      intent: "deny",
      action: "negated_action",
      newContext: context,
    };
  }

  // Si estamos en un flujo intermedio, manejar confirmación/denegación
  if (context.step === "confirming") {
    if (parsed.intent === "confirm") {
      return handleConfirmAppointment(tx, tenantId, phone, context);
    }
    if (parsed.intent === "deny") {
      return {
        reply: "Turno no confirmado. Queres buscar otro horario?",
        intent: "deny",
        action: "denied",
        newContext: {},
      };
    }
  }

  switch (parsed.intent) {
    case "greeting":
    case "help":
      return { reply: MENU_TEXT, intent: parsed.intent, newContext: {} };

    case "create_appointment":
      return handleCreateAppointment(tx, tenantId, phone, text, parsed.entities, context);

    case "query_appointment":
      return handleQueryAppointments(tx, tenantId, phone);

    case "cancel_appointment":
      return handleCancelAppointment(tx, tenantId, phone, context);

    case "reschedule_appointment":
      return handleRescheduleAppointment(tx, tenantId, phone, context);

    case "confirm":
      if (context.step === "confirming") {
        return handleConfirmAppointment(tx, tenantId, phone, context);
      }
      return { reply: "No hay nada pendiente para confirmar. " + MENU_TEXT, intent: "confirm", newContext: {} };

    case "deny":
      return { reply: "Entendido. " + MENU_TEXT, intent: "deny", newContext: {} };

    default:
      return {
        reply: "No entendi tu mensaje. Queres sacar un turno?\n\n" + MENU_TEXT,
        intent: "unknown",
        newContext: {},
      };
  }
}

// ─── Crear turno ─────────────────────────────────────────────────────────────

async function handleCreateAppointment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tenantId: string,
  phone: string,
  text: string,
  entities: { doctor_name?: string; date?: string; time?: string; specialty?: string },
  context: ConversationContext,
): Promise<HandleResult> {
  // Buscar paciente por teléfono
  const patient = await tx.patient.findFirst({
    where: { tenant_id: tenantId, phone: { contains: phone.slice(-10) } },
    select: { id: true, name: true },
  });

  if (!patient) {
    return {
      reply: "No encontre tu numero en nuestro sistema. Por favor, comunicate con la secretaria para registrarte primero.",
      intent: "create_appointment",
      action: "patient_not_found",
      newContext: {},
    };
  }

  // Buscar doctor por especialidad o tomar el primero disponible
  const doctorWhere = entities.specialty
    ? { tenant_id: tenantId, specialty: { contains: entities.specialty, mode: "insensitive" as const } }
    : { tenant_id: tenantId };

  const doctor = await tx.doctorProfile.findFirst({
    where: doctorWhere,
    include: { user: { select: { name: true } } },
  });

  if (!doctor) {
    return {
      reply: entities.specialty
        ? `No encontre doctores de ${entities.specialty}. Que especialidad necesitas?`
        : "No hay doctores disponibles en este momento.",
      intent: "create_appointment",
      action: "no_doctor",
      newContext: { ...context, patient_id: patient.id },
    };
  }

  // Construir preferredStart
  let preferredStart = new Date();
  if (entities.date) {
    preferredStart = new Date(entities.date);
    if (entities.time) {
      const [h, m] = entities.time.split(":").map(Number);
      preferredStart.setHours(h, m, 0, 0);
    } else {
      preferredStart.setHours(8, 0, 0, 0);
    }
  } else if (entities.time) {
    const [h, m] = entities.time.split(":").map(Number);
    const now = new Date();
    preferredStart.setHours(h, m, 0, 0);
    if (preferredStart <= now) {
      preferredStart.setDate(preferredStart.getDate() + 1);
    }
  }

  const tipoConsulta: TipoConsulta = detectTipoConsulta(text);
  const duration = getConsultationDuration(tipoConsulta);

  // Buscar próximo slot disponible
  const slot = await findNextAvailableSlot(doctor.user_id, duration, {
    tenantId,
    preferredStart,
    maxSearchDays: 30,
  });

  if (!slot) {
    return {
      reply: `No encontre turnos disponibles con ${doctor.user.name} en los proximos 30 dias. Queres intentar con otro doctor?`,
      intent: "create_appointment",
      action: "no_slot",
      newContext: { patient_id: patient.id },
    };
  }

  const dateStr = slot.start.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = slot.start.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    reply: `Encontre un turno disponible:\n\n` +
      `Doctor: *${doctor.user.name}*\n` +
      `Tipo: *${TIPO_CONSULTA_LABEL[tipoConsulta]}*\n` +
      `Fecha: *${dateStr}*\n` +
      `Hora: *${timeStr}*\n` +
      `Duracion: ${duration} minutos\n\n` +
      `Confirmas? (Si/No)`,
    intent: "create_appointment",
    action: "slot_proposed",
    newContext: {
      doctor_id: doctor.user_id,
      doctor_name: doctor.user.name,
      patient_id: patient.id,
      proposed_time: slot.start.toISOString(),
      proposed_slot_end: slot.end.toISOString(),
      duration,
      tipo_consulta: tipoConsulta,
      step: "confirming",
    },
  };
}

// ─── Confirmar turno ─────────────────────────────────────────────────────────

async function handleConfirmAppointment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tenantId: string,
  phone: string,
  context: ConversationContext,
): Promise<HandleResult> {
  if (!context.doctor_id || !context.patient_id || !context.proposed_time) {
    return {
      reply: "No hay un turno pendiente de confirmar. Queres sacar un turno nuevo?",
      intent: "confirm",
      action: "no_pending",
      newContext: {},
    };
  }

  const candidateStart = new Date(context.proposed_time);
  const duration = context.duration ?? DEFAULT_DURATION;
  const candidateEnd = new Date(candidateStart.getTime() + duration * 60_000);
  const idempotencyKey = `wa-${phone}-${context.proposed_time}`;

  // ===== IDEMPOTENCIA: Verificar si ya se creó este turno =====
  const existingByKey = await tx.appointment.findFirst({
    where: { tenant_id: tenantId, idempotency_key: idempotencyKey },
    select: { id: true, datetime: true, doctor_id: true },
  });

  if (existingByKey) {
    // Ya se creó este turno (retry o duplicado), responder éxito sin recrear
    logServer("info", "appointment.idempotent_hit", {
      idempotency_key: idempotencyKey,
      existing_id: existingByKey.id,
    });

    const existingDate = new Date(existingByKey.datetime);
    const dateStr = existingDate.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const timeStr = existingDate.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return {
      reply: `Tu turno ya estaba confirmado!\n\n` +
        `Doctor: *${context.doctor_name ?? ""}*\n` +
        `Fecha: *${dateStr}*\n` +
        `Hora: *${timeStr}*\n` +
        `Duracion: ${duration} min\n\n` +
        `Te esperamos!`,
      intent: "confirm",
      action: "appointment_idempotent",
      newContext: {
        pending_appointment_id: existingByKey.id,
      },
    };
  }

  // Lock + doble verificación dentro de transacción
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`doctor_schedule:${context.doctor_id}`}))`;

  // Verificar que sigue disponible
  const overlapping = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM appointments
    WHERE tenant_id = ${tenantId}
      AND doctor_id  = ${context.doctor_id}
      AND deleted_at IS NULL
      AND status NOT IN ('cancelled', 'no_show')
      AND datetime < ${candidateEnd}::timestamptz
      AND datetime + (duration || ' minutes')::interval > ${candidateStart}::timestamptz
    LIMIT 1
  `;

  if (overlapping.length > 0) {
    return {
      reply: "Lo siento, ese horario ya fue ocupado. Queres que busque otro?",
      intent: "confirm",
      action: "slot_taken",
      newContext: {
        ...context,
        step: undefined,
        proposed_time: undefined,
      },
    };
  }

  // Crear turno con idempotency_key (fallback: P2002 = ya creado concurrentemente)
  let appointment;
  try {
    appointment = await tx.appointment.create({
      data: {
        tenant_id: tenantId,
        patient_id: context.patient_id,
        doctor_id: context.doctor_id,
        datetime: candidateStart,
        duration,
        status: "scheduled",
        source: "whatsapp",
        idempotency_key: idempotencyKey,
        notes: `appointmentEngine:wa tipo_consulta:${context.tipo_consulta ?? "control"}`,
      },
    });
  } catch (error) {
    // P2002 = unique constraint (idempotency_key duplicada concurrente)
    if (
      typeof error === "object" && error !== null &&
      "code" in error && (error as { code: string }).code === "P2002"
    ) {
      logServer("info", "appointment.idempotent_concurrent", {
        idempotency_key: idempotencyKey,
      });
      // Recuperar el turno creado concurrentemente
      const concurrent = await tx.appointment.findFirst({
        where: { tenant_id: tenantId, idempotency_key: idempotencyKey },
      });
      if (concurrent) {
        const concurrentDate = new Date(concurrent.datetime);
        const dateStr = concurrentDate.toLocaleDateString("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        const timeStr = concurrentDate.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        return {
          reply: `Tu turno ya fue confirmado!\n\n` +
            `Fecha: *${dateStr}*\n` +
            `Hora: *${timeStr}*\n\n` +
            `Te esperamos!`,
          intent: "confirm",
          action: "appointment_idempotent",
          newContext: { pending_appointment_id: concurrent.id },
        };
      }
    }
    throw error;
  }

  const dateStr = candidateStart.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = candidateStart.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    reply: `Turno confirmado!\n\n` +
      `Doctor: *${context.doctor_name ?? ""}*\n` +
      `Fecha: *${dateStr}*\n` +
      `Hora: *${timeStr}*\n` +
      `Duracion: ${duration} min\n\n` +
      `Te esperamos! Si necesitas cancelar, escribi "cancelar turno".`,
    intent: "confirm",
    action: "appointment_created",
    newContext: {
      pending_appointment_id: appointment.id,
    },
  };
}

// ─── Consultar turnos ────────────────────────────────────────────────────────

async function handleQueryAppointments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tenantId: string,
  phone: string,
): Promise<HandleResult> {
  const patient = await tx.patient.findFirst({
    where: { tenant_id: tenantId, phone: { contains: phone.slice(-10) } },
    select: { id: true },
  });

  if (!patient) {
    return {
      reply: "No encontre tu numero en nuestro sistema.",
      intent: "query_appointment",
      action: "patient_not_found",
      newContext: {},
    };
  }

  const now = new Date();
  const appointments = await tx.appointment.findMany({
    where: {
      patient_id: patient.id,
      tenant_id: tenantId,
      deleted_at: null,
      status: { notIn: ["cancelled", "no_show"] },
      datetime: { gte: now },
    },
    include: {
      doctor: { include: { user: { select: { name: true } } } },
    },
    orderBy: { datetime: "asc" },
    take: 5,
  });

  if (appointments.length === 0) {
    return {
      reply: "No tenes turnos proximos. Queres sacar uno?",
      intent: "query_appointment",
      action: "no_appointments",
      newContext: {},
    };
  }

  const lines = appointments.map((a: {
    doctor: { user: { name: string } };
    datetime: Date;
    duration: number;
    status: string;
  }, i: number) => {
    const d = a.datetime.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const t = a.datetime.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${i + 1}. *${d} ${t}* - Dr. ${a.doctor.user.name} (${a.duration}min)`;
  });

  return {
    reply: `Tus proximos turnos:\n\n${lines.join("\n")}`,
    intent: "query_appointment",
    action: "listed",
    newContext: {},
  };
}

// ─── Cancelar turno ──────────────────────────────────────────────────────────

async function handleCancelAppointment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tenantId: string,
  phone: string,
  context: ConversationContext,
): Promise<HandleResult> {
  const patient = await tx.patient.findFirst({
    where: { tenant_id: tenantId, phone: { contains: phone.slice(-10) } },
    select: { id: true },
  });

  if (!patient) {
    return {
      reply: "No encontre tu numero en nuestro sistema.",
      intent: "cancel_appointment",
      action: "patient_not_found",
      newContext: {},
    };
  }

  const now = new Date();
  const nextAppointment = await tx.appointment.findFirst({
    where: {
      patient_id: patient.id,
      tenant_id: tenantId,
      deleted_at: null,
      status: { notIn: ["cancelled", "no_show", "completed"] },
      datetime: { gte: now },
    },
    include: {
      doctor: { include: { user: { select: { name: true } } } },
    },
    orderBy: { datetime: "asc" },
  });

  if (!nextAppointment) {
    return {
      reply: "No tenes turnos proximos para cancelar.",
      intent: "cancel_appointment",
      action: "no_appointments",
      newContext: {},
    };
  }

  await tx.appointment.updateMany({
    where: { id: nextAppointment.id, tenant_id: tenantId },
    data: { status: "cancelled" },
  });

  const d = nextAppointment.datetime.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const t = nextAppointment.datetime.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    reply: `Turno cancelado:\n\nDr. ${nextAppointment.doctor.user.name} - ${d} ${t}\n\nQueres sacar otro turno?`,
    intent: "cancel_appointment",
    action: "cancelled",
    newContext: {},
  };
}

// ─── Reprogramar turno ───────────────────────────────────────────────────────

async function handleRescheduleAppointment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tenantId: string,
  phone: string,
  context: ConversationContext,
): Promise<HandleResult> {
  const patient = await tx.patient.findFirst({
    where: { tenant_id: tenantId, phone: { contains: phone.slice(-10) } },
    select: { id: true },
  });

  if (!patient) {
    return {
      reply: "No encontre tu numero en nuestro sistema.",
      intent: "reschedule_appointment",
      action: "patient_not_found",
      newContext: {},
    };
  }

  const now = new Date();
  const nextAppointment = await tx.appointment.findFirst({
    where: {
      patient_id: patient.id,
      tenant_id: tenantId,
      deleted_at: null,
      status: { notIn: ["cancelled", "no_show", "completed"] },
      datetime: { gte: now },
    },
    include: {
      doctor: { include: { user: { select: { name: true } } } },
    },
    orderBy: { datetime: "asc" },
  });

  if (!nextAppointment) {
    return {
      reply: "No tenes turnos proximos para reprogramar.",
      intent: "reschedule_appointment",
      action: "no_appointments",
      newContext: {},
    };
  }

  // Cancelar el turno actual
  await tx.appointment.updateMany({
    where: { id: nextAppointment.id, tenant_id: tenantId },
    data: { status: "cancelled" },
  });

  // Buscar siguiente slot disponible
  const slot = await findNextAvailableSlot(
    nextAppointment.doctor_id,
    nextAppointment.duration,
    { tenantId, preferredStart: now, maxSearchDays: 30 },
  );

  if (!slot) {
    return {
      reply: `Turno cancelado pero no encontre nuevos horarios con Dr. ${nextAppointment.doctor.user.name}. Comunicate con la secretaria.`,
      intent: "reschedule_appointment",
      action: "no_slot",
      newContext: {},
    };
  }

  const dateStr = slot.start.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = slot.start.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    reply: `Turno anterior cancelado. Encontre este horario:\n\n` +
      `Doctor: *${nextAppointment.doctor.user.name}*\n` +
      `Fecha: *${dateStr}*\n` +
      `Hora: *${timeStr}*\n` +
      `Duracion: ${nextAppointment.duration} min\n\n` +
      `Confirmas? (Si/No)`,
    intent: "reschedule_appointment",
    action: "slot_proposed",
    newContext: {
      doctor_id: nextAppointment.doctor_id,
      doctor_name: nextAppointment.doctor.user.name,
      patient_id: patient.id,
      proposed_time: slot.start.toISOString(),
      proposed_slot_end: slot.end.toISOString(),
      duration: nextAppointment.duration,
      step: "confirming",
    },
  };
}
