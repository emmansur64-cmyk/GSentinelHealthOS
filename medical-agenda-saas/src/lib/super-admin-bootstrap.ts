import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { Role } from "@prisma/client";

import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSuperAdminDirectAccessTenantId } from "@/lib/super-admin-direct-access";

if (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD) {
  const candidateEnvFiles = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", ".env.local"),
  ];

  for (const envFile of candidateEnvFiles) {
    if (fs.existsSync(envFile)) {
      dotenv.config({ path: envFile, override: false });
    }
  }
}

export function getSuperAdminBootstrapConfig() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "soporte@gsentinelhealth.com.ar").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
  const name = (process.env.SUPER_ADMIN_NAME ?? "Soporte GSentinel").trim();
  const tenantId = getSuperAdminDirectAccessTenantId();

  return { email, password, name, tenantId };
}

export async function ensureSuperAdminAccount() {
  const { email, password, name, tenantId } = getSuperAdminBootstrapConfig();

  if (!password) {
    throw new Error("SUPER_ADMIN_PASSWORD es obligatorio para crear la cuenta super_admin");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!tenant) {
    throw new Error(`No existe tenant con id '${tenantId}'.`);
  }

  const passwordHash = await hashPassword(password);

  return prisma.user.upsert({
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
}