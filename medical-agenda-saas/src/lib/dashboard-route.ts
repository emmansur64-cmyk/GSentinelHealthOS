type DashboardRole =
  | "super_admin"
  | "clinic_owner"
  | "clinic_admin"
  | "admin"
  | "secretaria"
  | "receptionist"
  | "recepcionista"
  | "doctor"
  | "medico"
  | "auditor"
  | "patient";

export function getDashboardRouteByRole(role: DashboardRole): string {
  if (role === "super_admin") return "/admin";
  if (role === "doctor" || role === "medico") return "/doctor/dashboard";
  if (role === "admin") return "/dashboard/agenda";
  if (role === "secretaria" || role === "recepcionista" || role === "receptionist") return "/dashboard/agenda";
  if (role === "clinic_owner" || role === "clinic_admin") return "/dashboard/agenda";
  return "/dashboard/agenda";
}
