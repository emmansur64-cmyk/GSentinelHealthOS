import { AppointmentSource, AppointmentStatus, Role } from "@prisma/client";
import { z } from "zod";

const cleanText = (value: string) => value.replace(/[\u0000-\u001F\u007F]/g, "").trim();

const safeString = (min = 1, max = 5000) =>
  z
    .string()
    .transform((value) => cleanText(value))
    .pipe(z.string().min(min).max(max));

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  password: z.string().min(8).max(128),
  tenant: safeString(2, 80).optional(),
  tenant_slug: safeString(2, 80).optional(),
  clinic_slug: safeString(2, 80).optional(),
}).strict();

export const publicClinicRegistrationSchema = z.object({
  clinic_name: safeString(2, 160),
  tenant_slug: safeString(2, 80)
    .transform((value) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .pipe(z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalido")),
  owner_name: safeString(2, 120),
  owner_email: z.email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().trim().min(7).max(30).regex(/^[+\d\s\-()]+$/, "Telefono invalido").optional(),
  password: z.string().min(8).max(128),
}).strict();

function isDoctorLikeRole(role: string) {
  return role === "doctor" || role === "medico";
}

export const userCreateSchema = z.object({
  name: safeString(2, 120),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  role: z.enum(Role),
  specialty: safeString(2, 120).optional(),
  matricula: safeString(3, 60).optional(),
  ai_tag: safeString(3, 80).optional(),
}).strict().superRefine((data, ctx) => {
  if (!isDoctorLikeRole(data.role)) return;

  if (!data.specialty) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["specialty"],
      message: "specialty es obligatorio para role=doctor",
    });
  }

  if (!data.matricula) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matricula"],
      message: "matricula es obligatoria para role=doctor",
    });
  }

  if (!data.ai_tag) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ai_tag"],
      message: "ai_tag es obligatorio para role=doctor",
    });
  }
});

export const patientCreateSchema = z.object({
  name: safeString(2, 120),
  document: safeString(6, 40),
  contact: safeString(8, 60),
  insurance: safeString(1, 120).nullable().optional(),
  notes: safeString(1, 500).optional(),
}).strict();

export const doctorCreateSchema = z.object({
  name: safeString(2, 120),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(128),
  specialty: safeString(2, 120),
  matricula: safeString(3, 60),
  ai_tag: safeString(3, 80),
  appointment_duration: z.number().int().min(10).max(240).default(30),
  buffer_minutes: z.number().int().min(0).max(60).default(10),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default("08:00"),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default("18:00"),
  working_days: z.array(z.string().min(2).max(16)).min(1).default(["monday", "tuesday", "wednesday", "thursday", "friday"]),
}).strict();

export const doctorUpdateSchema = z.object({
  name: safeString(2, 120).optional(),
  specialty: safeString(2, 120).optional(),
  matricula: safeString(3, 60).optional(),
  ai_tag: safeString(3, 80).optional(),
  appointment_duration: z.number().int().min(10).max(240).optional(),
  buffer_minutes: z.number().int().min(0).max(60).optional(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  working_days: z.array(z.string().min(2).max(16)).min(1).optional(),
}).strict();

export const appointmentCreateSchema = z.object({
  patient_id: z.uuid(),
  doctor_id: z.uuid(),
  datetime: z.iso.datetime(),
  duration: z.number().int().min(10).max(240),
  status: z.enum(AppointmentStatus).default("scheduled"),
  source: z.enum(AppointmentSource).default("manual"),
  notes: safeString(1, 1000).optional(),
}).strict();

export const appointmentUpdateSchema = z.object({
  patient_id: z.uuid().optional(),
  doctor_id: z.uuid().optional(),
  datetime: z.iso.datetime().optional(),
  duration: z.number().int().min(10).max(240).optional(),
  status: z.enum(AppointmentStatus).optional(),
  source: z.enum(AppointmentSource).optional(),
  notes: safeString(1, 1000).optional(),
}).strict();

export const availabilityRuleSchema = z.object({
  doctor_id: z.uuid(),
  day_of_week: z.number().int().min(0).max(6),
  specific_date: z.iso.date().optional(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  slot_duration: z.number().int().min(10).max(180),
  autoCreateDoctors: z.boolean().optional(),
}).strict();

export const appointmentTodayQuerySchema = z.object({
  patient_id: z.uuid().optional(),
}).strict();

export const appointmentUpdateStatusSchema = z.object({
  appointment_id: z.uuid(),
  status: z.enum(["pending", "scheduled", "confirmed", "cancelled", "completed", "no_show"]).optional(),
  datetime: z.iso.datetime().optional(),
  duration: z.number().int().min(10).max(240).optional(),
  evolution: safeString(1, 4000).optional(),
}).strict();

export const appointmentCreateFollowupSchema = z.object({
  appointment_id: z.uuid(),
  days: z.number().int().min(1).max(365),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  source: z.enum(AppointmentSource).default("manual"),
  notes: safeString(1, 1000).optional(),
}).strict();

export const appointmentSuggestionsQuerySchema = z.object({
  doctor_id: z.uuid(),
  duration: z.coerce.number().int().min(10).max(240),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  preferred_start: z.iso.datetime().optional(),
}).strict();

export const patientUpdateSchema = z.object({
  name: safeString(2, 120).optional(),
  document: safeString(6, 40).optional(),
  contact: safeString(8, 60).optional(),
  insurance: safeString(1, 120).nullable().optional(),
  notes: safeString(1, 500).nullable().optional(),
}).strict();

export const availabilityRuleUpdateSchema = z.object({
  day_of_week: z.number().int().min(0).max(6).optional(),
  specific_date: z.iso.date().nullable().optional(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  slot_duration: z.number().int().min(10).max(180).optional(),
}).strict();

export const doctorAvailabilityMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2024).max(2100),
  month: z.coerce.number().int().min(1).max(12),
}).strict();

export const doctorAvailabilityMonthSlotSchema = z.object({
  id: z.uuid().optional(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
}).strict();

export const doctorAvailabilityMonthDaySchema = z.object({
  date: z.iso.date(),
  slots: z.array(doctorAvailabilityMonthSlotSchema).default([]),
}).strict();

export const doctorAvailabilityMonthSaveSchema = z.object({
  year: z.number().int().min(2024).max(2100),
  month: z.number().int().min(1).max(12),
  days: z.array(doctorAvailabilityMonthDaySchema),
}).strict();
