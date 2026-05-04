import { prisma } from "@/lib/prisma";
import { getAvailabilityRulesForRangeResolved } from "@/lib/doctor-availability";

export type AutoAssignDoctorCandidate = {
  user_id: string;
  specialty: string;
  user: {
    name: string;
  };
};

export type AvailabilityRuleRecord = {
  doctor_id: string;
  day_of_week: number;
  specific_date: Date | null;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

export type OccupiedInterval = {
  doctor_id: string;
  start: Date;
  end: Date;
};

export async function findDoctorCandidates(filters: {
  tenantId: string;
  specialty: string;
  doctorId?: string;
}): Promise<AutoAssignDoctorCandidate[]> {
  const doctors = await prisma.doctorProfile.findMany({
    where: {
      tenant_id: filters.tenantId,
      ...(filters.doctorId ? { user_id: filters.doctorId } : {}),
      specialty: {
        contains: filters.specialty,
        mode: "insensitive",
      },
    },
    select: {
      user_id: true,
      specialty: true,
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      user: {
        name: "asc",
      },
    },
  });

  return doctors;
}

export async function getDoctorAppointmentDurations(doctorIds: string[]): Promise<Map<string, number>> {
  if (doctorIds.length === 0) return new Map<string, number>();

  const rows = await prisma.agendaSettings.findMany({
    where: {
      user_id: {
        in: doctorIds,
      },
    },
    select: {
      user_id: true,
      appointment_duration: true,
    },
  });

  return new Map(rows.map((row) => [row.user_id, row.appointment_duration]));
}

export async function getAvailabilityRulesForRange(input: {
  tenantId: string;
  doctorIds: string[];
  from: Date;
  to: Date;
}): Promise<AvailabilityRuleRecord[]> {
  return getAvailabilityRulesForRangeResolved(input);
}

export async function getOccupiedIntervalsForRange(input: {
  tenantId: string;
  doctorIds: string[];
  from: Date;
  to: Date;
}): Promise<OccupiedInterval[]> {
  if (input.doctorIds.length === 0) return [];

  const paddedFrom = new Date(input.from.getTime() - 24 * 60 * 60 * 1000);
  const paddedTo = new Date(input.to.getTime() + 24 * 60 * 60 * 1000);

  const rows = await prisma.appointment.findMany({
    where: {
      tenant_id: input.tenantId,
      doctor_id: {
        in: input.doctorIds,
      },
      deleted_at: null,
      status: {
        notIn: ["cancelled", "no_show"],
      },
      datetime: {
        gte: paddedFrom,
        lte: paddedTo,
      },
    },
    select: {
      doctor_id: true,
      datetime: true,
      duration: true,
    },
    orderBy: [{ doctor_id: "asc" }, { datetime: "asc" }],
  });

  return rows.map((row) => ({
    doctor_id: row.doctor_id,
    start: row.datetime,
    end: new Date(row.datetime.getTime() + row.duration * 60_000),
  }));
}
