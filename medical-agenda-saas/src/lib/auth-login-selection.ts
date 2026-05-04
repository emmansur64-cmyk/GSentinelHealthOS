export type LoginCandidate = {
  role: string;
  tenant_id: string;
};

export function pickPreferredLoginCandidate<T extends LoginCandidate>(
  rows: T[],
  requestedTenantId: string | null,
): T | null {
  if (rows.length === 0) return null;

  if (requestedTenantId) {
    const exactTenantMatch = rows.find((row) => row.tenant_id === requestedTenantId && row.role !== "super_admin");
    if (exactTenantMatch) return exactTenantMatch;

    const superAdminMatch = rows.find((row) => row.role === "super_admin");
    if (superAdminMatch) return superAdminMatch;

    return rows[0];
  }

  const superAdminMatch = rows.find((row) => row.role === "super_admin");
  if (superAdminMatch) return superAdminMatch;

  return rows[0];
}
