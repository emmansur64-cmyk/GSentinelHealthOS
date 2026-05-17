import { callBrainDecide } from "@/lib/brain-client";
import { appendMedicalDisclaimer, buildEmergencyEscalationMessage, detectEmergency, enforceSafeMedicalResponse } from "@/lib/compliance/ai-safety";
import { auditLog } from "@/lib/compliance/audit-log";
import { hasActiveConsent } from "@/lib/compliance/consent";
import { metabrain, type MetaBrainDecision, type MetaBrainDecisionInput, type MetaBrainSource } from "@/lib/metabrain";
import { publishMetaBrainSignal } from "@/lib/metabrain-bridge";
import { logServer, logServerError } from "@/lib/server-logger";

type WhatsAppMetaBrainInput = {
  tx: {
    patient: {
      findMany(args: unknown): Promise<Array<{ id: string; name: string; phone: string; notes?: string | null }>>;
    };
    appointment: {
      findFirst(args: unknown): Promise<{
        id: string;
        datetime: Date;
        status: string;
        notes?: string | null;
        doctor?: { user?: { name: string } };
      } | null>;
      findMany(args: unknown): Promise<Array<{
        id: string;
        datetime: Date;
        status: string;
        notes?: string | null;
        doctor?: { user?: { name: string } };
      }>>;
    };
    doctorProfile: {
      findMany(args: unknown): Promise<Array<{
        user_id: string;
        specialty: string;
        matricula: string;
        ai_tag: string;
        user: { name: string };
        availabilityRule: Array<{
          day_of_week: number;
          specific_date: Date | null;
          start_time: string;
          end_time: string;
          slot_duration: number;
        }>;
        appointments: Array<{
          datetime: Date;
          duration: number;
          status: string;
        }>;
      }>>;
    };
    outgoingMessage: {
      findMany(args: unknown): Promise<Array<{ message: string; created_at: Date; status: string }>>;
    };
    incomingMessage: {
      findMany(args: unknown): Promise<Array<{ payload_json: unknown; received_at: Date; status: string }>>;
    };
  };
  tenantId: string;
  phone: string;
  text: string;
  contactName?: string;
  context?: Record<string, unknown>;
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
}

export function isWhatsAppMetaBrainEnabled(): boolean {
  return parseBoolean(process.env.WHATSAPP_METABRAIN_ENABLED, true);
}

function normalizeDigits(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

function phoneVariants(phone: string): string[] {
  const digits = normalizeDigits(phone);
  const variants = new Set<string>();
  if (digits) variants.add(digits);

  if (digits.startsWith("549") && digits.length >= 13) {
    const withoutMobilePrefix = `54${digits.slice(3)}`;
    variants.add(withoutMobilePrefix);

    const national = digits.slice(3);
    const areaLength = national.startsWith("11") ? 2 : national.length === 10 ? 3 : 4;
    variants.add(`54${national.slice(0, areaLength)}15${national.slice(areaLength)}`);
    variants.add(national);
    variants.add(national.slice(-10));
    variants.add(national.slice(-8));
  }

  variants.add(digits.slice(-10));
  variants.add(digits.slice(-8));

  return [...variants].filter(Boolean);
}

function normalizeSource(source: string | null | undefined): MetaBrainSource {
  const normalized = String(source ?? "").toUpperCase();
  if (normalized === "GROQ") return "GROQ";
  if (normalized === "DL") return "DL";
  if (normalized === "ML" || normalized === "METABRAIN" || normalized === "ORCHESTRATOR") return "ML";
  return "RULES";
}

function cleanResponse(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "Puedo ayudarte. Escribime tu consulta con un poco mas de detalle.";
  return text.slice(0, 3500);
}

function payloadText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const text = (payload as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function withMinutes(day: Date, minutes: number): Date {
  const next = startOfDay(day);
  next.setMinutes(minutes, 0, 0);
  return next;
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function overlaps(start: Date, end: Date, busy: Array<{ start: Date; end: Date }>): boolean {
  return busy.some((item) => item.start < end && item.end > start);
}

function formatDateTime(value: Date): string {
  return value.toLocaleString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildOpenSlots(args: {
  rules: Array<{
    day_of_week: number;
    specific_date: Date | null;
    start_time: string;
    end_time: string;
    slot_duration: number;
  }>;
  appointments: Array<{ datetime: Date; duration: number; status: string }>;
  maxDays?: number;
  limit?: number;
}): Array<{ start: string; end: string; duration_minutes: number }> {
  const maxDays = args.maxDays ?? 14;
  const limit = args.limit ?? 6;
  const now = new Date();
  const slots: Array<{ start: string; end: string; duration_minutes: number }> = [];

  for (let offset = 0; offset < maxDays && slots.length < limit; offset += 1) {
    const day = startOfDay(now);
    day.setDate(day.getDate() + offset);

    const dayRules = args.rules.filter((rule) => {
      if (rule.specific_date) return isSameDay(rule.specific_date, day);
      return rule.day_of_week === day.getDay();
    });
    if (dayRules.length === 0) continue;

    const busy = args.appointments
      .filter((appointment) => appointment.datetime >= startOfDay(day) && appointment.datetime <= endOfDay(day))
      .map((appointment) => ({
        start: appointment.datetime,
        end: new Date(appointment.datetime.getTime() + appointment.duration * 60_000),
      }));

    for (const rule of dayRules) {
      const step = Math.max(5, rule.slot_duration);
      const ruleStart = withMinutes(day, parseTimeToMinutes(rule.start_time));
      const ruleEnd = withMinutes(day, parseTimeToMinutes(rule.end_time));
      let cursor = ruleStart < now ? new Date(now) : ruleStart;

      const remainder = cursor.getMinutes() % step;
      if (remainder !== 0) cursor = new Date(cursor.getTime() + (step - remainder) * 60_000);
      cursor.setSeconds(0, 0);

      while (cursor < ruleEnd && slots.length < limit) {
        const candidateEnd = new Date(cursor.getTime() + step * 60_000);
        if (candidateEnd > ruleEnd) break;

        if (!overlaps(cursor, candidateEnd, busy)) {
          slots.push({
            start: formatDateTime(cursor),
            end: formatDateTime(candidateEnd),
            duration_minutes: step,
          });
        }

        cursor = new Date(cursor.getTime() + step * 60_000);
      }
    }
  }

  return slots;
}

function isFutureOrRecurringRule(rule: { specific_date: Date | null }, now: Date): boolean {
  if (!rule.specific_date) return true;
  return endOfDay(rule.specific_date) >= now;
}

function dayName(dayOfWeek: number): string {
  return ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][dayOfWeek] ?? String(dayOfWeek);
}

async function findPatient(input: WhatsAppMetaBrainInput): Promise<MetaBrainDecisionInput["context"]["patient"]> {
  const variants = phoneVariants(input.phone);
  if (variants.length === 0) return null;

  const candidates = await input.tx.patient.findMany({
    where: {
      tenant_id: input.tenantId,
      OR: variants.map((variant) => ({ phone: { contains: variant } })),
    },
    select: { id: true, name: true, phone: true, notes: true },
    take: 5,
  });

  const exact = candidates.find((patient) => normalizeDigits(patient.phone) === normalizeDigits(input.phone));
  const patient = exact ?? candidates[0];
  if (!patient) return null;

  return {
    id: patient.id,
    name: patient.name,
    phone: patient.phone,
    notes: patient.notes,
  };
}

async function buildContext(input: WhatsAppMetaBrainInput): Promise<MetaBrainDecisionInput["context"]> {
  const patient = await findPatient(input);
  const now = new Date();
  const agendaUntil = new Date(now.getTime() + 14 * 24 * 60 * 60_000);

  const currentAppointment = patient
    ? await input.tx.appointment.findFirst({
        where: {
          tenant_id: input.tenantId,
          patient_id: patient.id,
          deleted_at: null,
          status: { notIn: ["cancelled", "no_show"] },
          datetime: { gte: new Date() },
        },
        include: { doctor: { include: { user: { select: { name: true } } } } },
        orderBy: { datetime: "asc" },
      })
    : null;

  const recentHistory = patient
    ? await input.tx.appointment.findMany({
        where: { tenant_id: input.tenantId, patient_id: patient.id, deleted_at: null },
        include: { doctor: { include: { user: { select: { name: true } } } } },
        orderBy: { datetime: "desc" },
        take: 5,
      })
    : [];

  const [incoming, outgoing] = await Promise.all([
    input.tx.incomingMessage.findMany({
      where: { tenant_id: input.tenantId, from_phone: input.phone },
      orderBy: { received_at: "desc" },
      take: 4,
      select: { payload_json: true, received_at: true, status: true },
    }),
    input.tx.outgoingMessage.findMany({
      where: { tenant_id: input.tenantId, phone: input.phone },
      orderBy: { created_at: "desc" },
      take: 4,
      select: { message: true, created_at: true, status: true },
    }),
  ]);

  const doctors = await input.tx.doctorProfile.findMany({
    where: { tenant_id: input.tenantId },
    include: {
      user: { select: { name: true } },
      availabilityRule: {
        where: { tenant_id: input.tenantId },
        select: {
          day_of_week: true,
          specific_date: true,
          start_time: true,
          end_time: true,
          slot_duration: true,
        },
        orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
      },
      appointments: {
        where: {
          tenant_id: input.tenantId,
          deleted_at: null,
          status: { notIn: ["cancelled", "no_show"] },
          datetime: { gte: now, lte: agendaUntil },
        },
        select: {
          datetime: true,
          duration: true,
          status: true,
        },
        orderBy: { datetime: "asc" },
        take: 20,
      },
    },
    orderBy: { specialty: "asc" },
    take: 20,
  });

  const historySize = Math.min(incoming.length, outgoing.length, 4);
  const conversationHistory = Array.from({ length: historySize }, (_, index) => {
    const userEntry = incoming[historySize - index - 1];
    const botEntry = outgoing[historySize - index - 1];
    return {
      doctor_message: payloadText(userEntry?.payload_json),
      response: botEntry?.message ?? "",
      confidence: 0.8,
      source: "ML" as MetaBrainSource,
      action: "whatsapp_conversation",
      created_at: (botEntry?.created_at ?? userEntry?.received_at ?? new Date()).toISOString(),
    };
  }).filter((entry) => entry.doctor_message || entry.response);

  return {
    doctor_id: "whatsapp-metabrain",
    patient,
    current_appointment: currentAppointment
      ? {
          id: currentAppointment.id,
          datetime: currentAppointment.datetime.toISOString(),
          status: currentAppointment.status,
          notes: currentAppointment.notes,
        }
      : null,
    recent_history: recentHistory.map((appointment) => ({
      id: appointment.id,
      datetime: appointment.datetime.toISOString(),
      status: appointment.status,
      notes: appointment.notes,
      doctor_name: appointment.doctor?.user?.name ?? null,
    })),
    conversation_history: conversationHistory,
    clinical_state: patient?.notes ?? null,
    metadata: {
      channel: "whatsapp",
      phone: input.phone,
      contact_name: input.contactName ?? null,
      conversation_state: input.context ?? {},
      agenda: {
        readable: true,
        window_days: 14,
        generated_at: now.toISOString(),
        instruction: "Usar solo open_slots como disponibilidad concreta para ofrecer turnos. schedule_rules_future son horarios de atencion configurados, no turnos confirmados. No usar expired_rules como disponibilidad. No exponer datos de otros pacientes.",
        doctors: doctors.map((doctor) => {
          const futureRules = doctor.availabilityRule.filter((rule) => isFutureOrRecurringRule(rule, now));
          const expiredRulesCount = doctor.availabilityRule.length - futureRules.length;

          return {
            id: doctor.user_id,
            name: doctor.user.name,
            specialty: doctor.specialty,
            ai_tag: doctor.ai_tag,
            schedule_rules_future: futureRules.map((rule) => ({
              day: rule.specific_date ? null : dayName(rule.day_of_week),
              specific_date: rule.specific_date?.toISOString().slice(0, 10) ?? null,
              start_time: rule.start_time,
              end_time: rule.end_time,
              slot_duration: rule.slot_duration,
            })),
            expired_rules_count: expiredRulesCount,
            next_occupied: doctor.appointments.slice(0, 8).map((appointment) => ({
              datetime: formatDateTime(appointment.datetime),
              duration_minutes: appointment.duration,
              status: appointment.status,
            })),
            open_slots: buildOpenSlots({
              rules: futureRules,
              appointments: doctor.appointments,
              maxDays: 14,
              limit: 6,
            }),
          };
        }),
      },
    },
  };
}

export async function generateWhatsAppMetaBrainReply(input: WhatsAppMetaBrainInput): Promise<MetaBrainDecision | null> {
  if (!isWhatsAppMetaBrainEnabled()) return null;

  const context = await buildContext(input);
  const emergency = detectEmergency(input.text);

  if (emergency.detected) {
    await auditLog({
      tenantId: input.tenantId,
      patientId: context.patient?.id ?? null,
      entityType: "whatsapp_ai",
      entityId: context.patient?.id ?? null,
      action: "AI_ACCESS",
      metadata: {
        action: "emergency_escalation",
        reason: emergency.reason ?? null,
        channel: "whatsapp",
      },
    });

    return {
      action: "ESCALATE_EMERGENCY",
      response: buildEmergencyEscalationMessage(),
      confidence: 1,
      source: "RULES",
    };
  }

  if (context.patient?.id) {
    const hasConsent = await hasActiveConsent({
      tenantId: input.tenantId,
      patientId: context.patient.id,
      appliesTo: "WHATSAPP",
    });

    if (!hasConsent) {
      await auditLog({
        tenantId: input.tenantId,
        patientId: context.patient.id,
        entityType: "whatsapp_ai",
        entityId: context.patient.id,
        action: "SECURITY_DENIED",
        metadata: {
          reason: "missing_active_consent",
          applies_to: "WHATSAPP",
          channel: "whatsapp",
        },
      });

      return {
        action: "CONSENT_REQUIRED",
        response:
          "Para continuar con orientación clínica por WhatsApp necesitamos tu consentimiento informado activo. Escribí CONSENTIR para que la clínica gestione la autorización.",
        confidence: 1,
        source: "RULES",
      };
    }
  }

  const payload = {
    role: "DOCTOR" as const,
    message: input.text,
    context,
  };

  try {
    const brainResult = await callBrainDecide(payload);
    const decision: MetaBrainDecision = brainResult
      ? {
          action: brainResult.action,
          response: cleanResponse(brainResult.response),
          confidence: Number.isFinite(brainResult.confidence) ? brainResult.confidence : 0.8,
          source: normalizeSource(brainResult.source),
        }
      : await metabrain.decide(payload);

    decision.response = appendMedicalDisclaimer(enforceSafeMedicalResponse(cleanResponse(decision.response)));

    await auditLog({
      tenantId: input.tenantId,
      patientId: context.patient?.id ?? null,
      entityType: "whatsapp_ai",
      entityId: context.patient?.id ?? null,
      action: "AI_ACCESS",
      metadata: {
        action: decision.action,
        source: decision.source,
        confidence: decision.confidence,
        channel: "whatsapp",
      },
    });

    await publishMetaBrainSignal({
      event: "whatsapp.metabrain.completed",
      details: {
        phone: input.phone,
        patient_id: context.patient?.id ?? null,
        action: decision.action,
        source: decision.source,
        confidence: decision.confidence,
      },
    });

    logServer("info", "whatsapp.metabrain.completed", {
      phone: input.phone,
      action: decision.action,
      source: decision.source,
      confidence: decision.confidence,
    });

    return decision;
  } catch (error) {
    logServerError("whatsapp.metabrain.failed", error, { phone: input.phone });
    return null;
  }
}
