import { ok } from "@/lib/api-response";
import { publishMetaBrainHeartbeat } from "@/lib/metabrain-bridge";
import { getTenantLegacyFallbackMode } from "@/lib/tenant-legacy-policy";

export async function GET() {
  const tenantFallbackMode = getTenantLegacyFallbackMode();
  const metabrainConnected = await publishMetaBrainHeartbeat("ok", {
    tenant_fallback_mode: tenantFallbackMode,
  });

  return ok({
    status: metabrainConnected ? "ok" : "degraded",
    service: "medical-agenda-saas",
    tenant_fallback_mode: tenantFallbackMode,
    metabrain: {
      connected: metabrainConnected,
      channel: "redis.brain:integration:events",
    },
  });
}