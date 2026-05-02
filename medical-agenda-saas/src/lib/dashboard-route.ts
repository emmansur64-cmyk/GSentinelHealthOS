type DashboardRole =
  | "super_admin"
  | "clinic_owner"
  | "clinic_admin"
  | "admin"
  | "secretaria"
  | "receptionist"
  | "recepcionista"
  | "doctor"
  | "medico";

export function getDashboardRouteByRole(role: DashboardRole): string {
  if (role === "super_admin") return "/admin";
  if (role === "doctor" || role === "medico") return "/doctor/dashboard";
  if (role === "secretaria" || role === "recepcionista" || role === "receptionist") return "/dashboard/secretaria";
  if (role === "clinic_owner" || role === "clinic_admin") return "/dashboard/secretaria";
  return "/dashboard/agenda";
}
