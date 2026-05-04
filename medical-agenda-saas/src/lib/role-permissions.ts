export type AppRole =
  | "super_admin"
  | "clinic_owner"
  | "clinic_admin"
  | "admin"
  | "receptionist"
  | "recepcionista"
  | "secretaria"
  | "doctor"
  | "medico";

export function canAccessAdmin(role: string) {
  return role === "super_admin";
}

export function canManageClinicUsers(role: string) {
  return role === "clinic_owner" || role === "clinic_admin" || role === "admin";
}

export function canEditClinicConfiguration(role: string) {
  return role === "clinic_owner" || role === "clinic_admin" || role === "admin";
}

export function canOperateAgenda(role: string) {
  return [
    "clinic_owner",
    "clinic_admin",
    "admin",
    "receptionist",
    "recepcionista",
    "secretaria",
    "doctor",
    "medico",
  ].includes(role);
}
