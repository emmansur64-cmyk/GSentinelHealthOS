export function isSuperAdminRoleValue(role: string | null | undefined) {
  return String(role ?? "") === "super_admin";
}

export function canLoginWithClinicStatus(input: {
  role: string;
  userActive: boolean;
  userStatus: string | null | undefined;
  tenantStatus: string | null | undefined;
}) {
  if (!input.userActive || (input.userStatus ?? "active") !== "active") return false;
  if (isSuperAdminRoleValue(input.role)) return true;
  return input.tenantStatus === "active" || input.tenantStatus === "trial";
}
