import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { observeDbQuery } from "@/lib/observability/metrics";
import { getTenantIdFromContext } from "@/lib/tenant-context";

if (!process.env.DATABASE_URL) {
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

declare global {
  var __prismaRaw: PrismaClient | undefined;
  var __prismaQueryHookAttached: boolean | undefined;
}

const prismaClient =
  global.__prismaRaw ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [{ level: "query", emit: "event" }, "warn", "error"]
        : [{ level: "query", emit: "event" }, "error"],
  });

const TENANT_SCOPED_MODELS = new Set([
  "User",
  "AgendaSettings",
  "DoctorProfile",
  "Patient",
  "Appointment",
  "AvailabilityRule",
  "Session",
  "ActivityLog",
  "AuditLog",
  "IncomingMessage",
  "OutgoingMessage",
  "ConversationState",
  "RateLimit",
  "FailedMessage",
]);

const prismaWithTenantScope = prismaClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = getTenantIdFromContext();
        if (!tenantId || !model || !TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        const mutableArgs = args as Record<string, unknown>;

        if (
          operation === "findFirst" ||
          operation === "findMany" ||
          operation === "count" ||
          operation === "aggregate" ||
          operation === "groupBy" ||
          operation === "updateMany" ||
          operation === "deleteMany"
        ) {
          const where = (mutableArgs.where as Record<string, unknown> | undefined) ?? {};
          mutableArgs.where = {
            ...where,
            tenant_id: tenantId,
          };
        }

        if (operation === "create") {
          const data = (mutableArgs.data as Record<string, unknown> | undefined) ?? {};
          mutableArgs.data = {
            tenant_id: tenantId,
            ...data,
          };
        }

        if (operation === "createMany") {
          const data = mutableArgs.data;
          if (Array.isArray(data)) {
            mutableArgs.data = data.map((item) => ({ tenant_id: tenantId, ...(item as Record<string, unknown>) }));
          } else if (data && typeof data === "object") {
            mutableArgs.data = {
              tenant_id: tenantId,
              ...(data as Record<string, unknown>),
            };
          }
        }

        if (operation === "update") {
          const data = (mutableArgs.data as Record<string, unknown> | undefined) ?? {};
          mutableArgs.data = {
            ...data,
            tenant_id: tenantId,
          };
        }

        if (operation === "upsert") {
          const createData = (mutableArgs.create as Record<string, unknown> | undefined) ?? {};
          const updateData = (mutableArgs.update as Record<string, unknown> | undefined) ?? {};

          mutableArgs.create = {
            tenant_id: tenantId,
            ...createData,
          };

          mutableArgs.update = {
            ...updateData,
            tenant_id: tenantId,
          };
        }

        return query(mutableArgs);
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  global.__prismaRaw = prismaClient;
}

if (!global.__prismaQueryHookAttached) {
  const clientWithEvents = prismaClient as unknown as {
    $on?: (eventType: "query", cb: (event: { target?: string; duration: number }) => void) => void;
  };

  if (typeof clientWithEvents.$on === "function") {
    clientWithEvents.$on("query", (event) => {
      const [operation = "unknown", model = "unknown"] = event.target?.split(".") ?? [];
      observeDbQuery(model, operation, event.duration);
    });
  }

  if (process.env.NODE_ENV !== "production") {
    global.__prismaQueryHookAttached = true;
  }
}

export const prisma = prismaWithTenantScope as unknown as PrismaClient;