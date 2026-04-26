import { prisma } from "../prisma.js";

function mapSettings(settings) {
  return {
    appointment_duration: settings.appointmentMinutes,
    buffer_minutes: settings.bufferMinutes,
    start_time: settings.workStartTime,
    end_time: settings.workEndTime,
    working_days: settings.workDays,
  };
}

export async function getSettings() {
  const settings = await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  return mapSettings(settings);
}

export async function updateSettings(input) {
  const settings = await prisma.settings.upsert({
    where: { id: "default" },
    update: {
      appointmentMinutes: input.appointment_duration,
      bufferMinutes: input.buffer_minutes,
      workStartTime: input.start_time,
      workEndTime: input.end_time,
      workDays: input.working_days,
    },
    create: {
      id: "default",
      appointmentMinutes: input.appointment_duration,
      bufferMinutes: input.buffer_minutes,
      workStartTime: input.start_time,
      workEndTime: input.end_time,
      workDays: input.working_days,
    },
  });

  return mapSettings(settings);
}
