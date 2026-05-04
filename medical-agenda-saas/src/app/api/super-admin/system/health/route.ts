import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

import Redis from "ioredis";

import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi } from "@/lib/super-admin";

const execFileAsync = promisify(execFile);

async function diskUsage() {
  try {
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      "Get-PSDrive -Name C | Select-Object -ExpandProperty Free",
    ], { timeout: 3000 });
    return { available_bytes: Number(stdout.trim()) || null };
  } catch {
    return { available_bytes: null };
  }
}

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  let redis = "not_configured";
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const client = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await client.connect();
      await client.ping();
      redis = "ok";
    } catch {
      redis = "error";
    } finally {
      client.disconnect();
    }
  }

  const gatewayUrl = process.env.WHATSAPP_GATEWAY_HEALTH_URL || process.env.WHATSAPP_GATEWAY_URL;
  let whatsappGateway = gatewayUrl ? "unknown" : "not_configured";
  if (gatewayUrl) {
    try {
      const response = await fetch(gatewayUrl, { cache: "no-store", signal: AbortSignal.timeout(3000) });
      whatsappGateway = response.ok ? "ok" : "error";
    } catch {
      whatsappGateway = "error";
    }
  }

  const recentExceptions = await prisma.$queryRaw`
    SELECT id, tenant_id AS clinic_id, error_message, status, created_at
    FROM failed_messages
    ORDER BY created_at DESC
    LIMIT 20
  `;

  return ok({
    api: "ok",
    database,
    redis,
    whatsapp_gateway: whatsappGateway,
    memory: {
      total_bytes: os.totalmem(),
      free_bytes: os.freemem(),
      process_rss_bytes: process.memoryUsage().rss,
    },
    disk: await diskUsage(),
    recent_exceptions: recentExceptions,
  });
}
