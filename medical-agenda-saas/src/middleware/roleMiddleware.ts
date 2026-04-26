export type CanonicalRole = "admin" | "medico" | "recepcionista";

export function normalizeRole(role: string): CanonicalRole {
  if (role === "admin") return "admin";
  if (role === "doctor" || role === "medico") return "medico";
  return "recepcionista";
}

export function roleMatches(userRole: string, allowedRoles: string[]): boolean {
  const userCanonical = normalizeRole(userRole);
  return allowedRoles.some((role) => normalizeRole(role) === userCanonical);
}
