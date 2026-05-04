import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { fail, ok } from "@/lib/api-response";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logServer } from "@/lib/server-logger";
import { publicClinicRegistrationSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const parsed = publicClinicRegistrationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail("Payload invalido", 422, parsed.error.flatten());
    }

    const { clinic_name: clinicName, tenant_slug: tenantSlug, owner_name: ownerName, owner_email: ownerEmail, password, phone } = parsed.data;

    const [existingTenant, existingUser] = await Promise.all([
      prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: { email: { equals: ownerEmail, mode: "insensitive" } },
        select: { id: true },
      }),
    ]);

    if (existingTenant) return fail("Ya existe una clinica con ese slug", 409, { code: "TENANT_SLUG_TAKEN" });
    if (existingUser) return fail("Ya existe un usuario con ese email", 409, { code: "OWNER_EMAIL_TAKEN" });

    const passwordHash = await hashPassword(password);

    const created = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nombre: clinicName,
          slug: tenantSlug,
          email: ownerEmail,
          phone: phone ?? null,
          estado: "trial",
          plan: "basico",
        },
        select: {
          id: true,
          nombre: true,
          slug: true,
          estado: true,
          plan: true,
        },
      });

      const owner = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          name: ownerName,
          email: ownerEmail,
          role: "clinic_owner",
          password_hash: passwordHash,
          auth_provider: "password",
          provider: "password",
          active: true,
          status: "active",
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      return { tenant, owner };
    });

    logServer("info", "public.clinic_registered", {
      tenant_id: created.tenant.id,
      tenant_slug: created.tenant.slug,
      owner_user_id: created.owner.id,
      welcome_email_stub: true,
    });

    return ok(
      {
        tenant_id: created.tenant.id,
        tenant_slug: created.tenant.slug,
        clinic_name: created.tenant.nombre,
        status: created.tenant.estado,
        plan: created.tenant.plan,
        owner_user_id: created.owner.id,
        owner_email: created.owner.email,
        login_hint: {
          email: created.owner.email,
          tenant_slug: created.tenant.slug,
        },
        welcome_email: "stubbed",
      },
      201,
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("La clinica o el email ya existen", 409, { code: "UNIQUE_CONSTRAINT" });
    }

    return fail("No se pudo registrar la clinica", 500, error instanceof Error ? error.message : null);
  }
}
