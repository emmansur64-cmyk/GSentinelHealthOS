export type TenantLegacyFallbackMode = "permissive" | "strict";

const RAW_MODE = (process.env.TENANT_LEGACY_FALLBACK_MODE ?? "permissive").trim().toLowerCase();

export function getTenantLegacyFallbackMode(): TenantLegacyFallbackMode {
  return RAW_MODE === "strict" ? "strict" : "permissive";
}

export function isTenantLegacyFallbackStrict(): boolean {
  return getTenantLegacyFallbackMode() === "strict";
}
