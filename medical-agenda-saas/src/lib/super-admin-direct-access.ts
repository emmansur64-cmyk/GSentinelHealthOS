export function isSuperAdminDirectAccessEnabled() {
  const value = (process.env.SUPER_ADMIN_DIRECT_ACCESS ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function getSuperAdminDirectAccessTenantId() {
  return (process.env.SUPER_ADMIN_TENANT_ID ?? process.env.DEFAULT_TENANT_ID ?? "default").trim();
}
