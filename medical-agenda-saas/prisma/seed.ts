import fs from "node:fs";
import path from "node:path";

import { PrismaClient, Role, TenantPlan, TenantStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

const DEFAULT_SECRETARIA_EMAIL = "secretaria@clinic.local";
const DEFAULT_SECRETARIA_PASSWORD = "ChangeMe123!";
const DEFAULT_TENANT_ID = "default";

function loadSeedEnv() {
  const envFiles = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", ".env.local"),
  ];

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      dotenv.config({ path: envFile, override: false });
    }
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const frontendDatabaseUrl = process.env.FRONTEND_DATABASE_URL?.trim();
  const prismaCompatible = databaseUrl?.startsWith("postgresql://") || databaseUrl?.startsWith("postgres://");

  if (!prismaCompatible && frontendDatabaseUrl) {
    process.env.DATABASE_URL = frontendDatabaseUrl;
  }
}

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes", "y", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function isLocalLabSeedAllowed() {
  if (process.env.NODE_ENV !== "production") return true;

  return (
    isTruthy(process.env.SEED_LOCAL_LAB_ENABLED) ||
    isTruthy(process.env.LOCAL_LAB_SEED_ENABLED) ||
    isTruthy(process.env.ENABLE_LOCAL_LAB_SEED)
  );
}

function readRequiredSeedValue(envName: string, localDefault: string) {
  const explicit = process.env[envName]?.trim();
  if (explicit) return explicit;

  if (isLocalLabSeedAllowed()) return localDefault;

  throw new Error(`${envName} es obligatorio fuera de entorno local/lab.`);
}

async function hashSeedPassword(password: string) {
  // Mantiene el mismo mecanismo que src/lib/auth.ts: bcryptjs con cost factor 12.
  return bcrypt.hash(password, 12);
}

async function main() {
  loadSeedEnv();

  if (!isLocalLabSeedAllowed()) {
    console.log("Seed local/lab omitido: NODE_ENV=production sin flag explicito de laboratorio.");
    return;
  }

  const prisma = new PrismaClient();

  try {
    const tenantId = (process.env.SEED_SECRETARIA_TENANT_ID ?? process.env.DEFAULT_TENANT_ID ?? DEFAULT_TENANT_ID)
      .trim()
      .toLowerCase();
    const email = readRequiredSeedValue("SEED_SECRETARIA_EMAIL", DEFAULT_SECRETARIA_EMAIL).toLowerCase();
    const password = readRequiredSeedValue("SEED_SECRETARIA_PASSWORD", DEFAULT_SECRETARIA_PASSWORD);
    const name = (process.env.SEED_SECRETARIA_NAME ?? "Secretaria Principal").trim();
    const shouldResetPassword = isTruthy(process.env.SEED_SECRETARIA_RESET_PASSWORD);

    const tenant = await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {
        estado: TenantStatus.active,
        maintenance_mode: false,
      },
      create: {
        id: tenantId,
        nombre: "Clinica Demo Local",
        slug: tenantId,
        email,
        plan: TenantPlan.basico,
        estado: TenantStatus.active,
        maintenance_mode: false,
      },
      select: {
        id: true,
        slug: true,
        estado: true,
      },
    });

    const existingUser = await prisma.user.findUnique({
      where: {
        tenant_id_email: {
          tenant_id: tenant.id,
          email,
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        tenant_id: true,
        password_hash: true,
      },
    });
    const sameEmailUsers = await prisma.user.findMany({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        tenant_id: true,
      },
    });
    const sameEmailOutsideTenant = sameEmailUsers.filter((user) => user.tenant_id !== tenant.id);

    if (!existingUser && sameEmailOutsideTenant.length > 0) {
      throw new Error(
        `Seed abortado: ya existe ${email} en otro tenant. No se crea duplicado cross-tenant sin revision manual.`,
      );
    }

    const passwordHash = existingUser?.password_hash && !shouldResetPassword
      ? existingUser.password_hash
      : await hashSeedPassword(password);

    const user = await prisma.user.upsert({
      where: {
        tenant_id_email: {
          tenant_id: tenant.id,
          email,
        },
      },
      update: {
        name,
        role: Role.secretaria,
        active: true,
        status: "active",
        auth_provider: "password",
        provider: "password",
        password_hash: passwordHash,
      },
      create: {
        tenant_id: tenant.id,
        name,
        email,
        role: Role.secretaria,
        active: true,
        status: "active",
        auth_provider: "password",
        provider: "password",
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

    console.log(
      JSON.stringify(
        {
          ok: true,
          seed: "local_lab_secretaria",
          tenant,
          user,
          password_reset: Boolean(existingUser && shouldResetPassword),
          password_set_on_create: !existingUser,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
