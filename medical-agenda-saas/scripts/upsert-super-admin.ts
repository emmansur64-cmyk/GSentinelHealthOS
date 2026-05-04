import { Role } from "@prisma/client";

import { hashPassword } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "soporte@gsentinelhealth.com.ar").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
  const name = (process.env.SUPER_ADMIN_NAME ?? "Soporte GSentinel").trim();
  const tenantId = (process.env.SUPER_ADMIN_TENANT_ID ?? process.env.DEFAULT_TENANT_ID ?? "default").trim();

  if (!password) {
    throw new Error("SUPER_ADMIN_PASSWORD es obligatorio para ejecutar el upsert.");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, estado: true },
  });

  if (!tenant) {
    throw new Error(`No existe tenant con id '${tenantId}'. Aborta para evitar crear super_admin sin contexto valido.`);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: {
      tenant_id_email: {
        tenant_id: tenantId,
        email,
      },
    },
    update: {
      name,
      role: "super_admin" as Role,
      active: true,
      status: "active",
      provider: "password",
      auth_provider: "password",
      password_hash: passwordHash,
    },
    create: {
      tenant_id: tenantId,
      email,
      name,
      role: "super_admin" as Role,
      active: true,
      status: "active",
      provider: "password",
      auth_provider: "password",
      password_hash: passwordHash,
    },
    select: {
      id: true,
      email: true,
      role: true,
      tenant_id: true,
      active: true,
      status: true,
    },
  });

  const duplicates = await prisma.user.count({
    where: {
      email,
      NOT: { id: user.id },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        user,
        tenant,
        duplicate_email_records_other_tenants: duplicates,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
