import { zod as z } from "../middleware/validate.middleware.js";

const statusEnum = z.enum(["pending", "confirmed", "cancelled"]);

export const getAppointmentsSchema = z.object({
  query: z.object({
    date: z.string().optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const createAppointmentSchema = z.object({
  body: z.object({
    patientId: z.string().min(1),
    doctorId: z.string().min(1),
    datetime: z.string().datetime(),
    duration: z.number().int().min(10).max(240),
    status: statusEnum.default("pending"),
    reason: z.string().max(500).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const patchAppointmentSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    datetime: z.string().datetime().optional(),
    duration: z.number().int().min(10).max(240).optional(),
    status: statusEnum.optional(),
    reason: z.string().max(500).optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  }),
  query: z.object({}).optional(),
});

export const deleteAppointmentSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});
