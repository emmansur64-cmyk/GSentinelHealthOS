import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAdminClinics, getRequestIp, requireSuperAdminApi, writeAdminAudit } from "@/lib/super-admin";
import {
  provisionTenantUser,
  TenantUserProvisioningConflictError,
  TenantUserProvisioningValidationError,
} from "@/lib/tenant-user-provisioning";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  return ok(await getAdminClinics());
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return fail("Nombre de clinica requerido", 422);

  const legalName = String(body?.legal_name ?? "").trim() || null;
  const email = String(body?.email ?? "").trim() || null;
  const phone = String(body?.phone ?? "").trim() || null;
  const ownerFullName = String(body?.owner_full_name ?? "").trim();
  const ownerEmail = String(body?.owner_email ?? "").trim().toLowerCase();
  const ownerPassword = String(body?.owner_password ?? "");
  const secretaryFullName = String(body?.secretary_full_name ?? "").trim();
  const secretaryEmail = String(body?.secretary_email ?? "").trim().toLowerCase();
  const secretaryPassword = String(body?.secretary_password ?? "");
  const doctorFullName = String(body?.doctor_full_name ?? "").trim();
  const doctorEmail = String(body?.doctor_email ?? "").trim().toLowerCase();
  const doctorPassword = String(body?.doctor_password ?? "");
  const doctorSpecialty = String(body?.doctor_specialty ?? "").trim();
  const doctorMatricula = String(body?.doctor_matricula ?? "").trim();
  const doctorAiTag = String(body?.doctor_ai_tag ?? "").trim();
  const slug =
    String(body?.slug ?? name)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || crypto.randomUUID();

  try {
    if (!ownerFullName || !ownerEmail || ownerPassword.length < 8) {
      return fail("Datos del usuario dueño incompletos", 422);
    }

    if ((secretaryFullName || secretaryEmail || secretaryPassword) && (!secretaryFullName || !secretaryEmail || secretaryPassword.length < 8)) {
      return fail("Para crear acceso de secretaria se requiere nombre, email y contrasena valida", 422);
    }

    if (
      doctorFullName ||
      doctorEmail ||
      doctorPassword ||
      doctorSpecialty ||
      doctorMatricula ||
      doctorAiTag
    ) {
      if (!doctorFullName || !doctorEmail || doctorPassword.length < 8 || !doctorSpecialty || !doctorMatricula) {
        return fail(
          "Para crear acceso de doctor se requiere nombre, email, contrasena, especialidad y matricula",
          422,
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nombre: name,
          slug,
          legal_name: legalName,
          email,
          phone,
          estado: "active",
        },
        select: { id: true },
      });

      const owner = await provisionTenantUser(tx, {
        tenantId: tenant.id,
        fullName: ownerFullName,
        email: ownerEmail,
        password: ownerPassword,
        role: "clinic_owner",
      });

      let secretaryId: string | null = null;
      if (secretaryFullName && secretaryEmail && secretaryPassword.length >= 8) {
        const secretary = await provisionTenantUser(tx, {
          tenantId: tenant.id,
          fullName: secretaryFullName,
          email: secretaryEmail,
          password: secretaryPassword,
          role: "secretaria",
        });
        secretaryId = secretary.id;
      }

      let doctorId: string | null = null;
      if (doctorFullName && doctorEmail && doctorPassword.length >= 8 && doctorSpecialty && doctorMatricula) {
        const doctor = await provisionTenantUser(tx, {
          tenantId: tenant.id,
          fullName: doctorFullName,
          email: doctorEmail,
          password: doctorPassword,
          role: "doctor",
          specialty: doctorSpecialty,
          matricula: doctorMatricula,
          aiTag: doctorAiTag || null,
        });
        doctorId = doctor.id;
      }

      return { id: tenant.id, ownerId: owner.id, secretaryId, doctorId };
    });

    await writeAdminAudit({
      actorUserId: auth.user.userId,
      action: "clinic_created",
      targetType: "clinic",
      targetId: created.id,
      clinicId: created.id,
      metadata: {
        name,
        email,
        owner_user_id: created.ownerId,
        secretary_user_id: created.secretaryId,
        doctor_user_id: created.doctorId,
      },
      ipAddress: getRequestIp(request),
    });

    return ok({
      id: created.id,
      owner_user_id: created.ownerId,
      secretary_user_id: created.secretaryId,
      doctor_user_id: created.doctorId,
    }, 201);
  } catch (error) {
    if (error instanceof TenantUserProvisioningValidationError) {
      return fail(error.message, 422, error.details);
    }

    if (error instanceof TenantUserProvisioningConflictError) {
      return fail(error.message, 409);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("Ya existe una clinica o usuario con esos datos", 409, { code: "UNIQUE_CONSTRAINT" });
    }
    return fail("No se pudo crear clinica", 500, error instanceof Error ? error.message : null);
  }
}
