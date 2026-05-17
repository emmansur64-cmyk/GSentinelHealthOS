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
    const exactTenantMatch = rows.find((row) => row.tenant_id === requestedTenantId);
    if (exactTenantMatch) return exactTenantMatch;
  }

  return rows[0];
}
