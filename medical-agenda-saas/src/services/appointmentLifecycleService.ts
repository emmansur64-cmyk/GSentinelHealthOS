import { prisma } from "@/lib/prisma";
import { logServer, logServerError } from "@/lib/server-logger";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";

const ENGINE_TAG = "appointmentEngine";
const REMINDER_MARKER = "appointmentEngine.recordatorio_24h_enviado";
const AUTO_CANCEL_MARKER = "appointmentEngine.autocancelado_sin_confirmacion";

type LifecycleAppointment = {
  id: string;
  datetime: Date;
  notes: string | null;
  patient: {
    name: string;
    phone: string;
  };
  doctor: {
    user: {
      name: string;
    };
  };
};

export type AppointmentLifecycleJobResult = {
  remindersSent: number;
  autoCancelled: number;
  skippedWithoutPhone: number;
};

function readReminderLookaheadHours(): number {
  const raw = process.env.APPOINTMENT_REMINDER_LOOKAHEAD_HOURS?.trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 24;
  return parsed;
}

function readCancellationLeadHours(): number {
  const raw = process.env.APPOINTMENT_CONFIRMATION_CANCEL_HOURS_BEFORE?.trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 12;
  return parsed;
}

function isEngineManaged(notes: string | null): boolean {
  return typeof notes === "string" && notes.includes(ENGINE_TAG);
}

function hasMarker(notes: string | null, marker: string): boolean {
  return typeof notes === "string" && notes.includes(marker);
}

function appendMarker(notes: string | null, marker: string, value: string): string {
  const base = (notes ?? "").trim();
  const line = `[${marker}=${value}]`;
  if (!base) return line;
  if (base.includes(line)) return base;
  return `${base}\n${line}`;
}

function isSendableWhatsAppPhone(phone: string | null | undefined): phone is string {
  if (!phone) return false;
  if (phone.startsWith("pending-")) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10;
}

function formatAppointmentDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatAppointmentTime(date: Date): string {
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildReminderMessage(appointment: LifecycleAppointment): string {
  return [
    `Recordatorio de turno para ${appointment.patient.name}.`,
    `Dr. ${appointment.doctor.user.name} - ${formatAppointmentDate(appointment.datetime)} ${formatAppointmentTime(appointment.datetime)}.`,
    "Responde SI para confirmar o NO para liberar el turno.",
  ].join("\n");
}

function buildAutoCancellationMessage(appointment: LifecycleAppointment): string {
  return [
    `Tu turno con Dr. ${appointment.doctor.user.name} del ${formatAppointmentDate(appointment.datetime)} ${formatAppointmentTime(appointment.datetime)} fue cancelado automaticamente por falta de confirmacion.`,
    "Si quieres, responde a este mensaje para buscar un nuevo horario.",
  ].join("\n");
}

async function loadReminderCandidates(now: Date, reminderLookaheadHours: number, cancellationLeadHours: number): Promise<LifecycleAppointment[]> {
  const reminderDeadline = new Date(now.getTime() + reminderLookaheadHours * 60 * 60 * 1000);
  const cancellationDeadline = new Date(now.getTime() + cancellationLeadHours * 60 * 60 * 1000);

  return prisma.appointment.findMany({
    where: {
      deleted_at: null,
      status: "scheduled",
      notes: { contains: ENGINE_TAG },
      datetime: {
        gt: cancellationDeadline,
        lte: reminderDeadline,
      },
    },
    include: {
      patient: { select: { name: true, phone: true } },
      doctor: { include: { user: { select: { name: true } } } },
    },
  });
}

async function loadAutoCancellationCandidates(now: Date, cancellationLeadHours: number): Promise<LifecycleAppointment[]> {
  const cancellationDeadline = new Date(now.getTime() + cancellationLeadHours * 60 * 60 * 1000);

  return prisma.appointment.findMany({
    where: {
      deleted_at: null,
      status: "scheduled",
      notes: { contains: ENGINE_TAG },
      datetime: {
        lte: cancellationDeadline,
      },
    },
    include: {
      patient: { select: { name: true, phone: true } },
      doctor: { include: { user: { select: { name: true } } } },
    },
  });
}

export async function runAppointmentLifecycleJobs(now = new Date()): Promise<AppointmentLifecycleJobResult> {
  const reminderLookaheadHours = readReminderLookaheadHours();
  const cancellationLeadHours = readCancellationLeadHours();
  const result: AppointmentLifecycleJobResult = {
    remindersSent: 0,
    autoCancelled: 0,
    skippedWithoutPhone: 0,
  };

  const reminderCandidates = await loadReminderCandidates(now, reminderLookaheadHours, cancellationLeadHours);
  for (const appointment of reminderCandidates) {
    if (!isEngineManaged(appointment.notes) || hasMarker(appointment.notes, REMINDER_MARKER)) {
      continue;
    }

    if (!isSendableWhatsAppPhone(appointment.patient.phone)) {
      result.skippedWithoutPhone += 1;
      continue;
    }

    try {
      const sent = await sendWhatsAppMessage(appointment.patient.phone, buildReminderMessage(appointment));
      if (!sent.success) continue;

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          notes: appendMarker(appointment.notes, REMINDER_MARKER, now.toISOString()),
        },
      });
      result.remindersSent += 1;
    } catch (error) {
      logServerError("appointment.lifecycle.reminder_failed", error, {
        appointment_id: appointment.id,
      });
    }
  }

  const autoCancellationCandidates = await loadAutoCancellationCandidates(now, cancellationLeadHours);
  for (const appointment of autoCancellationCandidates) {
    if (!isEngineManaged(appointment.notes) || hasMarker(appointment.notes, AUTO_CANCEL_MARKER)) {
      continue;
    }

    try {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          status: "cancelled",
          notes: appendMarker(appointment.notes, AUTO_CANCEL_MARKER, now.toISOString()),
        },
      });
      result.autoCancelled += 1;

      if (isSendableWhatsAppPhone(appointment.patient.phone)) {
        await sendWhatsAppMessage(appointment.patient.phone, buildAutoCancellationMessage(appointment));
      } else {
        result.skippedWithoutPhone += 1;
      }
    } catch (error) {
      logServerError("appointment.lifecycle.auto_cancel_failed", error, {
        appointment_id: appointment.id,
      });
    }
  }

  logServer("info", "appointment.lifecycle.completed", {
    reminders_sent: result.remindersSent,
    auto_cancelled: result.autoCancelled,
    skipped_without_phone: result.skippedWithoutPhone,
  });

  return result;
}