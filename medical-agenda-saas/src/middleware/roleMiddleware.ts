export type CanonicalRole = "super_admin" | "admin" | "medico" | "recepcionista";

export function normalizeRole(role: string): CanonicalRole {
  if (role === "super_admin") return "super_admin";
  if (role === "clinic_owner" || role === "clinic_admin") return "admin";
  if (role === "admin") return "admin";
  if (role === "doctor" || role === "medico") return "medico";
  return "recepcionista";
}

export function roleMatches(userRole: string, allowedRoles: string[]): boolean {
  const userCanonical = normalizeRole(userRole);
  return allowedRoles.some((role) => normalizeRole(role) === userCanonical);
}
