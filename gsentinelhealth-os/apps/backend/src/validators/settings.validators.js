import { zod as z } from "../middleware/validate.middleware.js";

const workDaysEnum = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

export const updateSettingsSchema = z.object({
  body: z.object({
    appointment_duration: z.number().int().min(10).max(180),
    buffer_minutes: z.number().int().min(0).max(120),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    working_days: z.array(workDaysEnum).min(1),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});
