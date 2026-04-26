/**
 * Consistency Validator for Stress Testing
 *
 * Valida la consistencia de los datos después de tests de carga.
 * Detecta duplicados, solapamientos y violaciones de integridad.
 */
import { PrismaClient } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConsistencyReport {
  valid: boolean;
  checks: ConsistencyCheck[];
  summary: {
    totalAppointments: number;
    duplicateAppointments: number;
    overlappingSlots: number;
    idempotencyViolations: number;
    orphanedRecords: number;
  };
}

export interface ConsistencyCheck {
  name: string;
  passed: boolean;
  details: string;
  count?: number;
}

export interface OverlappingSlot {
  doctorId: string;
  datetime: Date;
  appointments: Array<{
    id: string;
    patientId: string;
    duration: number;
  }>;
}

export interface DuplicateMessage {
  messageId: string;
  count: number;
}

// ─── Consistency Validator Class ─────────────────────────────────────────────

export class ConsistencyValidator {
  private prisma: PrismaClient;
  private testRunPrefix?: string;

  constructor(prisma: PrismaClient, testRunPrefix?: string) {
    this.prisma = prisma;
    this.testRunPrefix = testRunPrefix;
  }

  /**
   * Ejecuta todas las validaciones de consistencia.
   */
  async validate(): Promise<ConsistencyReport> {
    const checks: ConsistencyCheck[] = [];

    // 1. Verificar duplicados en appointments
    const duplicates = await this.checkDuplicateAppointments();
    checks.push(duplicates);

    // 2. Verificar solapamientos de horarios
    const overlaps = await this.checkOverlappingSlots();
    checks.push(overlaps);

    // 3. Verificar idempotencia de mensajes
    const idempotency = await this.checkMessageIdempotency();
    checks.push(idempotency);

    // 4. Verificar integridad referencial
    const referential = await this.checkReferentialIntegrity();
    checks.push(referential);

    // 5. Verificar estados consistentes
    const states = await this.checkConsistentStates();
    checks.push(states);

    // 6. Verificar mensajes huérfanos en cola
    const orphaned = await this.checkOrphanedMessages();
    checks.push(orphaned);

    const summary = {
      totalAppointments: await this.countAppointments(),
      duplicateAppointments: duplicates.count ?? 0,
      overlappingSlots: overlaps.count ?? 0,
      idempotencyViolations: idempotency.count ?? 0,
      orphanedRecords: orphaned.count ?? 0,
    };

    return {
      valid: checks.every((c) => c.passed),
      checks,
      summary,
    };
  }

  /**
   * Verifica que no hay turnos duplicados (mismo paciente, doctor, horario).
   */
  private async checkDuplicateAppointments(): Promise<ConsistencyCheck> {
    const duplicates = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM (
        SELECT patient_id, doctor_id, datetime
        FROM appointments
        WHERE deleted_at IS NULL
          AND status NOT IN ('cancelled', 'no_show')
        GROUP BY patient_id, doctor_id, datetime
        HAVING COUNT(*) > 1
      ) as dups
    `;

    const count = Number(duplicates[0]?.count ?? 0);

    return {
      name: "No duplicate appointments",
      passed: count === 0,
      details:
        count === 0
          ? "No duplicate appointments found"
          : `Found ${count} duplicate appointment groups`,
      count,
    };
  }

  /**
   * Verifica que no hay solapamiento de horarios para el mismo doctor.
   */
  private async checkOverlappingSlots(): Promise<ConsistencyCheck> {
    // Buscar appointments que se solapen en el tiempo para el mismo doctor
    const overlaps = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM (
        SELECT 
          a1.id,
          a1.doctor_id,
          a1.datetime as start1,
          a1.datetime + (a1.duration || ' minutes')::interval as end1
        FROM appointments a1
        JOIN appointments a2 ON 
          a1.doctor_id = a2.doctor_id 
          AND a1.id < a2.id
          AND a1.deleted_at IS NULL
          AND a2.deleted_at IS NULL
          AND a1.status NOT IN ('cancelled', 'no_show')
          AND a2.status NOT IN ('cancelled', 'no_show')
        WHERE 
          a1.datetime < a2.datetime + (a2.duration || ' minutes')::interval
          AND a2.datetime < a1.datetime + (a1.duration || ' minutes')::interval
      ) as overlaps
    `;

    const count = Number(overlaps[0]?.count ?? 0);

    return {
      name: "No overlapping slots",
      passed: count === 0,
      details:
        count === 0
          ? "No overlapping appointments found"
          : `Found ${count} overlapping appointment pairs`,
      count,
    };
  }

  /**
   * Verifica que las keys de idempotencia son únicas.
   */
  private async checkMessageIdempotency(): Promise<ConsistencyCheck> {
    // Verificar duplicados en incoming_messages (por message_id)
    const duplicateMessages = await this.prisma.$queryRaw<
      Array<{ message_id: string; cnt: bigint }>
    >`
      SELECT message_id, COUNT(*) as cnt
      FROM incoming_messages
      GROUP BY message_id
      HAVING COUNT(*) > 1
    `;

    const count = duplicateMessages.length;

    return {
      name: "Message idempotency",
      passed: count === 0,
      details:
        count === 0
          ? "All messages have unique IDs"
          : `Found ${count} message IDs with duplicates`,
      count,
    };
  }

  /**
   * Verifica integridad referencial.
   */
  private async checkReferentialIntegrity(): Promise<ConsistencyCheck> {
    // Appointments sin paciente válido
    const orphanAppointments = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      WHERE p.id IS NULL AND a.deleted_at IS NULL
    `;

    // Appointments sin doctor válido
    const orphanDoctors = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM appointments a
      LEFT JOIN doctor_profiles d ON a.doctor_id = d.user_id
      WHERE d.user_id IS NULL AND a.deleted_at IS NULL
    `;

    const totalOrphans =
      Number(orphanAppointments[0]?.count ?? 0) +
      Number(orphanDoctors[0]?.count ?? 0);

    return {
      name: "Referential integrity",
      passed: totalOrphans === 0,
      details:
        totalOrphans === 0
          ? "All references are valid"
          : `Found ${totalOrphans} orphaned records`,
      count: totalOrphans,
    };
  }

  /**
   * Verifica estados consistentes.
   */
  private async checkConsistentStates(): Promise<ConsistencyCheck> {
    // Mensajes en estado "processing" por más de 5 minutos (stuck)
    const stuckMessages = await this.prisma.incomingMessage.count({
      where: {
        status: "processing",
        received_at: {
          lt: new Date(Date.now() - 5 * 60 * 1000), // más de 5 min
        },
      },
    });

    return {
      name: "Consistent states",
      passed: stuckMessages === 0,
      details:
        stuckMessages === 0
          ? "No stuck processing states"
          : `Found ${stuckMessages} messages stuck in processing`,
      count: stuckMessages,
    };
  }

  /**
   * Verifica mensajes huérfanos (pendientes sin procesar).
   */
  private async checkOrphanedMessages(): Promise<ConsistencyCheck> {
    // Mensajes pending por más de 10 minutos
    const orphanedCount = await this.prisma.incomingMessage.count({
      where: {
        status: "pending",
        received_at: {
          lt: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
    });

    return {
      name: "No orphaned messages",
      passed: orphanedCount < 10, // Permitir algunos pendientes
      details:
        orphanedCount < 10
          ? `${orphanedCount} pending messages (acceptable)`
          : `Found ${orphanedCount} orphaned pending messages`,
      count: orphanedCount,
    };
  }

  /**
   * Cuenta total de appointments.
   */
  private async countAppointments(): Promise<number> {
    return this.prisma.appointment.count({
      where: {
        deleted_at: null,
        status: { notIn: ["cancelled", "no_show"] },
      },
    });
  }

  /**
   * Genera reporte en formato texto.
   */
  async generateReport(): Promise<string> {
    const report = await this.validate();

    const lines: string[] = [
      "",
      "═══════════════════════════════════════════════════════════════════",
      "                 CONSISTENCY VALIDATION REPORT",
      "═══════════════════════════════════════════════════════════════════",
      "",
      "SUMMARY",
      "───────────────────────────────────────────────────────────────────",
      `  Total Appointments:      ${report.summary.totalAppointments}`,
      `  Duplicate Appointments:  ${report.summary.duplicateAppointments}`,
      `  Overlapping Slots:       ${report.summary.overlappingSlots}`,
      `  Idempotency Violations:  ${report.summary.idempotencyViolations}`,
      `  Orphaned Records:        ${report.summary.orphanedRecords}`,
      "",
      "CHECKS",
      "───────────────────────────────────────────────────────────────────",
    ];

    for (const check of report.checks) {
      const status = check.passed ? "PASS" : "FAIL";
      lines.push(`  [${status}] ${check.name}`);
      lines.push(`         ${check.details}`);
    }

    lines.push(
      "",
      "═══════════════════════════════════════════════════════════════════",
      `  OVERALL RESULT: ${report.valid ? "VALID" : "INCONSISTENT"}`,
      "═══════════════════════════════════════════════════════════════════",
      "",
    );

    return lines.join("\n");
  }
}

// ─── Specific Validators ─────────────────────────────────────────────────────

/**
 * Valida que solo un turno fue creado para un slot específico
 * (para test de concurrencia crítica).
 */
export async function validateSingleSlotWinner(
  prisma: PrismaClient,
  doctorId: string,
  datetime: Date,
  windowMinutes: number = 30,
): Promise<{
  valid: boolean;
  appointmentCount: number;
  appointments: Array<{ id: string; patientId: string; createdAt: Date }>;
}> {
  const windowStart = new Date(datetime.getTime() - windowMinutes * 60 * 1000);
  const windowEnd = new Date(datetime.getTime() + windowMinutes * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctor_id: doctorId,
      datetime: {
        gte: windowStart,
        lte: windowEnd,
      },
      deleted_at: null,
      status: { notIn: ["cancelled", "no_show"] },
    },
    select: {
      id: true,
      patient_id: true,
      created_at: true,
    },
    orderBy: { created_at: "asc" },
  });

  return {
    valid: appointments.length <= 1,
    appointmentCount: appointments.length,
    appointments: appointments.map((a) => ({
      id: a.id,
      patientId: a.patient_id,
      createdAt: a.created_at,
    })),
  };
}

/**
 * Obtiene estadísticas de turnos creados durante el test.
 */
export async function getAppointmentStats(
  prisma: PrismaClient,
  since: Date,
): Promise<{
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  uniquePatients: number;
  uniqueDoctors: number;
}> {
  const appointments = await prisma.appointment.findMany({
    where: {
      created_at: { gte: since },
    },
    select: {
      status: true,
      source: true,
      patient_id: true,
      doctor_id: true,
    },
  });

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const patients = new Set<string>();
  const doctors = new Set<string>();

  for (const apt of appointments) {
    byStatus[apt.status] = (byStatus[apt.status] || 0) + 1;
    bySource[apt.source] = (bySource[apt.source] || 0) + 1;
    patients.add(apt.patient_id);
    doctors.add(apt.doctor_id);
  }

  return {
    total: appointments.length,
    byStatus,
    bySource,
    uniquePatients: patients.size,
    uniqueDoctors: doctors.size,
  };
}
