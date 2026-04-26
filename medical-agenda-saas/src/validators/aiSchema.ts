import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string): string {
  return sanitizeText(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((chunk) => `${chunk.charAt(0).toUpperCase()}${chunk.slice(1)}`)
    .join(" ");
}

function normalizeMatricula(value: string): string {
  return sanitizeText(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeTime(value: string): string {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map((part) => Number(part));
  return hour * 60 + minute;
}

const blockSchema = z
  .object({
    inicio: z.string().regex(timeRegex, "inicio debe tener formato HH:mm"),
    fin: z.string().regex(timeRegex, "fin debe tener formato HH:mm"),
  })
  .strict();

const scheduleDaySchema = z
  .object({
    fecha: z.iso.date(),
    bloques: z.array(blockSchema).min(1, "Debe incluir al menos un bloque"),
  })
  .strict();

export const aiIntakeSchema = z
  .object({
    doctor: z
      .object({
        nombre: z.string().min(2).max(120),
        especialidad: z.string().min(2).max(120).optional(),
        matricula: z.string().min(3).max(60).optional(),
      })
      .strict(),
    schedule: z.array(scheduleDaySchema).min(1, "Debe incluir al menos un dia de agenda"),
  })
  .strict()
  .superRefine((data, ctx) => {
    data.schedule.forEach((day, dayIndex) => {
      const dayKeys = new Set<string>();

      day.bloques.forEach((block, blockIndex) => {
        const startMinutes = toMinutes(block.inicio);
        const endMinutes = toMinutes(block.fin);

        if (startMinutes >= endMinutes) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["schedule", dayIndex, "bloques", blockIndex, "inicio"],
            message: "inicio debe ser menor que fin",
          });
        }

        const key = `${day.fecha}|${normalizeTime(block.inicio)}|${normalizeTime(block.fin)}`;
        if (dayKeys.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["schedule", dayIndex, "bloques", blockIndex],
            message: "bloque duplicado en la misma fecha",
          });
          return;
        }

        dayKeys.add(key);
      });
    });
  });

export type AiIntakeInput = z.infer<typeof aiIntakeSchema>;

export type NormalizedAiIntake = {
  doctor: {
    nombre: string;
    especialidad: string;
    matricula: string | null;
  };
  schedule: Array<{
    fecha: string;
    bloques: Array<{
      inicio: string;
      fin: string;
    }>;
  }>;
};

export function normalizeAiIntakeInput(input: AiIntakeInput): NormalizedAiIntake {
  return {
    doctor: {
      nombre: toTitleCase(input.doctor.nombre),
      especialidad: input.doctor.especialidad ? toTitleCase(input.doctor.especialidad) : "General",
      matricula: input.doctor.matricula ? normalizeMatricula(input.doctor.matricula) : null,
    },
    schedule: input.schedule.map((day) => ({
      fecha: day.fecha,
      bloques: day.bloques.map((block) => ({
        inicio: normalizeTime(block.inicio),
        fin: normalizeTime(block.fin),
      })),
    })),
  };
}
