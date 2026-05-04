import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { fail, ok } from "@/lib/api-response";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminClinics, getRequestIp, requireSuperAdminApi, writeAdminAudit } from "@/lib/super-admin";

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
  const slug =
    String(body?.slug ?? name)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || crypto.randomUUID();

  try {
    const passwordHash =
      ownerFullName && ownerEmail && ownerPassword.length >= 8
        ? await hashPassword(ownerPassword)
        : null;

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

      let ownerId: string | null = null;
      if (passwordHash) {
        const owner = await tx.user.create({
          data: {
            tenant_id: tenant.id,
            name: ownerFullName,
            email: ownerEmail,
            role: "clinic_owner",
            password_hash: passwordHash,
            auth_provider: "password",
            provider: "password",
            status: "active",
            active: true,
          },
          select: { id: true },
        });
        ownerId = owner.id;
      }

      return { id: tenant.id, ownerId };
    });

    await writeAdminAudit({
      actorUserId: auth.user.userId,
      action: "clinic_created",
      targetType: "clinic",
      targetId: created.id,
      clinicId: created.id,
      metadata: { name, email, owner_user_id: created.ownerId },
      ipAddress: getRequestIp(request),
    });

    return ok({ id: created.id, owner_user_id: created.ownerId }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("Ya existe una clinica o usuario con esos datos", 409, { code: "UNIQUE_CONSTRAINT" });
    }
    return fail("No se pudo crear clinica", 500, error instanceof Error ? error.message : null);
  }
}
