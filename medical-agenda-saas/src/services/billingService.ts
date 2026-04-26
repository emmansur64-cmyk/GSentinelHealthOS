import { prisma } from "@/lib/prisma";
import { publishMetaBrainSignal } from "@/lib/metabrain-bridge";
import { isTenantLegacyFallbackStrict } from "@/lib/tenant-legacy-policy";

const DEFAULT_TENANT_PLAN: TenantPlanSnapshot = {
  tenantId: process.env.DEFAULT_TENANT_ID?.trim() || "default",
  plan: "profesional",
  limite_medicos: 20,
  limite_turnos_mensuales: 5000,
};

function isMissingTenantRelationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("42p01") || message.includes("relation \"tenants\"") || message.includes("relación «tenants»");
}

export class BillingLimitError extends Error {
  readonly code: "DOCTOR_LIMIT_REACHED" | "APPOINTMENT_LIMIT_REACHED";

  constructor(code: "DOCTOR_LIMIT_REACHED" | "APPOINTMENT_LIMIT_REACHED", message: string) {
    super(message);
    this.name = "BillingLimitError";
    this.code = code;
  }
}

type TenantPlanSnapshot = {
  tenantId: string;
  plan: "basico" | "profesional" | "enterprise";
  limite_medicos: number;
  limite_turnos_mensuales: number;
};

export async function getTenantPlanSnapshot(tenantId: string): Promise<TenantPlanSnapshot> {
  let rows: Array<{
    id: string;
    plan: "basico" | "profesional" | "enterprise";
    limite_medicos: number;
    limite_turnos_mensuales: number;
    estado: "active" | "suspended" | "trial";
  }> = [];

  try {
    rows = await prisma.$queryRaw<Array<{
      id: string;
      plan: "basico" | "profesional" | "enterprise";
      limite_medicos: number;
      limite_turnos_mensuales: number;
      estado: "active" | "suspended" | "trial";
    }>>`
      SELECT id, plan::text AS plan, limite_medicos, limite_turnos_mensuales, estado::text AS estado
      FROM tenants
      WHERE id = ${tenantId}
      LIMIT 1
    `;
  } catch (error) {
    // Compatibilidad con DB legacy sin tabla tenants.
    if (isMissingTenantRelationError(error)) {
      if (isTenantLegacyFallbackStrict()) {
        await publishMetaBrainSignal({
          event: "tenant_schema_required",
          severity: "error",
          details: { area: "billing.getTenantPlanSnapshot", tenant_id: tenantId },
        });
        throw new Error("TENANT_SCHEMA_REQUIRED");
      }

      await publishMetaBrainSignal({
        event: "tenant_legacy_fallback_used",
        severity: "warn",
        details: { area: "billing.getTenantPlanSnapshot", tenant_id: tenantId },
      });

      return {
        ...DEFAULT_TENANT_PLAN,
        tenantId,
      };
    }
    throw error;
  }

  const tenant = rows[0] ?? null;

  if (!tenant) {
    throw new Error("TENANT_NOT_FOUND");
  }

  if (tenant.estado !== "active" && tenant.estado !== "trial") {
    throw new Error("TENANT_INACTIVE");
  }

  return {
    tenantId: tenant.id,
    plan: tenant.plan,
    limite_medicos: tenant.limite_medicos,
    limite_turnos_mensuales: tenant.limite_turnos_mensuales,
  };
}

export async function assertCanCreateDoctor(tenantId: string): Promise<void> {
  const [plan, doctorCount] = await Promise.all([
    getTenantPlanSnapshot(tenantId),
    prisma.doctorProfile.count(),
  ]);

  if (doctorCount >= plan.limite_medicos) {
    throw new BillingLimitError(
      "DOCTOR_LIMIT_REACHED",
      `Limite de medicos alcanzado para plan ${plan.plan}. Limite=${plan.limite_medicos}`,
    );
  }
}

export async function assertCanCreateAppointment(tenantId: string, referenceDate = new Date()): Promise<void> {
  const plan = await getTenantPlanSnapshot(tenantId);

  const startMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0);
  const startNextMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1, 0, 0, 0, 0);

  const monthlyAppointments = await prisma.appointment.count({
    where: {
      deleted_at: null,
      created_at: {
        gte: startMonth,
        lt: startNextMonth,
      },
      status: {
        not: "cancelled",
      },
    },
  });

  if (monthlyAppointments >= plan.limite_turnos_mensuales) {
    throw new BillingLimitError(
      "APPOINTMENT_LIMIT_REACHED",
      `Limite mensual de turnos alcanzado para plan ${plan.plan}. Limite=${plan.limite_turnos_mensuales}`,
    );
  }
}
