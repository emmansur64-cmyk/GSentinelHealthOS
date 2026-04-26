import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/server-auth";

const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type WorkingDay = (typeof WEEK_DAYS)[number];

const settingsSchema = z
  .object({
    appointment_duration: z.number().int().min(10).max(180),
    buffer_minutes: z.number().int().min(0).max(120),
    start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    working_days: z.array(z.enum(WEEK_DAYS)).min(1),
  })
  .strict();

const defaultSettings = {
  appointment_duration: 30,
  buffer_minutes: 10,
  start_time: "08:00",
  end_time: "18:00",
  working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"] as WorkingDay[],
};

type SettingsRow = {
  appointment_duration: number;
  buffer_minutes: number;
  start_time: string;
  end_time: string;
  working_days: unknown;
};

function normalizeWorkingDays(value: unknown): WorkingDay[] {
  if (!Array.isArray(value)) return defaultSettings.working_days;

  const allowed = new Set(WEEK_DAYS);
  const valid = value
    .filter((item): item is string => typeof item === "string")
    .filter((item): item is WorkingDay => allowed.has(item as WorkingDay));

  return valid.length > 0 ? valid : defaultSettings.working_days;
}

export async function GET() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const rows = await prisma.$queryRaw<SettingsRow[]>`
    SELECT appointment_duration, buffer_minutes, start_time, end_time, working_days
    FROM agenda_settings
    WHERE user_id = ${authUser.userId}
    LIMIT 1
  `;

  if (rows.length === 0) return ok(defaultSettings);

  const row = rows[0];
  return ok({
    appointment_duration: row.appointment_duration,
    buffer_minutes: row.buffer_minutes,
    start_time: row.start_time,
    end_time: row.end_time,
    working_days: normalizeWorkingDays(row.working_days),
  });
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

  if (parsed.data.start_time >= parsed.data.end_time) {
    return fail("start_time debe ser anterior a end_time", 422);
  }

  const serializedDays = JSON.stringify(parsed.data.working_days);

  await prisma.$executeRaw`
    INSERT INTO agenda_settings (
      user_id,
      appointment_duration,
      buffer_minutes,
      start_time,
      end_time,
      working_days,
      updated_at
    )
    VALUES (
      ${authUser.userId},
      ${parsed.data.appointment_duration},
      ${parsed.data.buffer_minutes},
      ${parsed.data.start_time},
      ${parsed.data.end_time},
      ${serializedDays}::jsonb,
      NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      appointment_duration = EXCLUDED.appointment_duration,
      buffer_minutes = EXCLUDED.buffer_minutes,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      working_days = EXCLUDED.working_days,
      updated_at = NOW()
  `;

  return ok(parsed.data);
}