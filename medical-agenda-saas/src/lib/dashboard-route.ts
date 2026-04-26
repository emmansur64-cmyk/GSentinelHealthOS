type DashboardRole = "admin" | "secretaria" | "recepcionista" | "doctor" | "medico";

export function getDashboardRouteByRole(role: DashboardRole): string {
  if (role === "doctor" || role === "medico") return "/dashboard/doctor";
  if (role === "secretaria" || role === "recepcionista") return "/dashboard/secretaria";
  return "/dashboard/overview";
}