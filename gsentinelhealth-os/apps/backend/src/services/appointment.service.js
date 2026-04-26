import { prisma } from "../prisma.js";
import { HttpError } from "../lib/http-error.js";

function toDto(appointment) {
  const duration = Math.max(10, Math.round((appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60000));
  return {
    id: appointment.id,
    datetime: appointment.startsAt.toISOString(),
    duration,
    status: appointment.status,
    reason: appointment.reason,
    patient: {
      id: appointment.patient.id,
      name: appointment.patient.fullName,
    },
    doctor: {
      id: appointment.doctor.id,
      name: appointment.doctor.fullName,
      specialty: appointment.doctor.specialty,
    },
  };
}

function toDateRange(dateStr) {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw new HttpError(400, "Invalid date format. Use YYYY-MM-DD");
  }

  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getAppointmentsByDate(date) {
  const { start, end } = toDateRange(date);

  const rows = await prisma.appointment.findMany({
    where: { startsAt: { gte: start, lte: end } },
    include: {
      patient: true,
      doctor: true,
    },
    orderBy: { startsAt: "asc" },
  });

  return rows.map(toDto);
}

export async function createAppointment(input) {
  const startsAt = new Date(input.datetime);
  const endsAt = new Date(startsAt.getTime() + input.duration * 60000);

  if (Number.isNaN(startsAt.getTime())) {
    throw new HttpError(400, "Invalid datetime value");
  }

  const patient = await prisma.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) throw new HttpError(404, "Patient not found");

  const doctor = await prisma.doctor.findUnique({ where: { id: input.doctorId } });
  if (!doctor) throw new HttpError(404, "Doctor not found");

  const created = await prisma.appointment.create({
    data: {
      startsAt,
      endsAt,
      status: input.status,
      reason: input.reason || null,
      patientId: input.patientId,
      doctorId: input.doctorId,
    },
    include: { patient: true, doctor: true },
  });

  return toDto(created);
}

export async function updateAppointment(id, input) {
  const current = await prisma.appointment.findUnique({
    where: { id },
    include: { patient: true, doctor: true },
  });

  if (!current) {
    throw new HttpError(404, "Appointment not found");
  }

  const startsAt = input.datetime ? new Date(input.datetime) : current.startsAt;
  if (Number.isNaN(startsAt.getTime())) {
    throw new HttpError(400, "Invalid datetime value");
  }

  const duration = input.duration ?? Math.round((current.endsAt.getTime() - current.startsAt.getTime()) / 60000);
  const endsAt = new Date(startsAt.getTime() + duration * 60000);

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      startsAt,
      endsAt,
      status: input.status ?? current.status,
      reason: Object.prototype.hasOwnProperty.call(input, "reason") ? (input.reason || null) : current.reason,
    },
    include: { patient: true, doctor: true },
  });

  return toDto(updated);
}

export async function deleteAppointment(id) {
  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Appointment not found");

  await prisma.appointment.delete({ where: { id } });
  return { id };
}
