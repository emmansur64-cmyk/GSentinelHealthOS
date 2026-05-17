import { Prisma, Role } from "@prisma/client";

import { hashPassword } from "@/lib/auth";

export class TenantUserProvisioningValidationError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "TenantUserProvisioningValidationError";
    this.details = details;
  }
}

export class TenantUserProvisioningConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantUserProvisioningConflictError";
  }
}

const DOCTOR_ROLES = new Set(["doctor", "medico"]);

function normalizeRole(input: string): Role {
  const value = String(input ?? "").trim().toLowerCase();

  if (value === "clinic_owner") return "clinic_owner";
  if (value === "clinic_admin") return "clinic_admin";
  if (value === "admin") return "admin";
  if (value === "receptionist") return "receptionist";
  if (value === "recepcionista") return "recepcionista";
  if (value === "secretaria") return "secretaria";
  if (value === "doctor") return "doctor";
  if (value === "medico") return "medico";

  throw new TenantUserProvisioningValidationError("Rol invalido", { role: input });
}

function buildDoctorAiTag(name: string, matricula: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = matricula
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  const combined = `${slug || "doctor"}-${suffix || "ai"}`;
  return combined.slice(0, 80);
}

export type ProvisionTenantUserInput = {
  tenantId: string;
  fullName: string;
  email: string;
  password: string;
  role: string;
  specialty?: string | null;
  matricula?: string | null;
  aiTag?: string | null;
};

export async function provisionTenantUser(
  tx: Prisma.TransactionClient,
  input: ProvisionTenantUserInput,
) {
  const tenantId = String(input.tenantId ?? "").trim();
  const fullName = String(input.fullName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");

  if (!tenantId) {
    throw new TenantUserProvisioningValidationError("tenant_id requerido");
  }
  if (!fullName || !email || password.length < 8) {
    throw new TenantUserProvisioningValidationError("Nombre, email y contrasena son requeridos");
  }

  const role = normalizeRole(input.role);
  if (role === "super_admin") {
    throw new TenantUserProvisioningValidationError("No se permite crear super_admin en provisionamiento de tenant");
  }

  const existing = await tx.user.findFirst({
    where: { tenant_id: tenantId, email },
    select: { id: true },
  });
  if (existing) {
    throw new TenantUserProvisioningConflictError("El email ya existe en esta clinica");
  }

  const passwordHash = await hashPassword(password);

  const user = await tx.user.create({
    data: {
      tenant_id: tenantId,
      name: fullName,
      email,
      role,
      password_hash: passwordHash,
      auth_provider: "password",
      provider: "password",
      status: "active",
      active: true,
    },
    select: { id: true, role: true, email: true, name: true },
  });

  if (DOCTOR_ROLES.has(role)) {
    const specialty = String(input.specialty ?? "").trim();
    const matricula = String(input.matricula ?? "").trim();
    const aiTag = String(input.aiTag ?? "").trim() || buildDoctorAiTag(fullName, matricula);

    if (!specialty || !matricula) {
      throw new TenantUserProvisioningValidationError(
        "Para rol doctor/medico se requiere specialty y matricula",
      );
    }

    await tx.doctorProfile.create({
      data: {
        user_id: user.id,
        tenant_id: tenantId,
        specialty,
        matricula,
        ai_tag: aiTag,
      },
    });
  }

  return user;
}
