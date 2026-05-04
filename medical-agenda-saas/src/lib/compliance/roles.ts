export type ComplianceRole =
  | "SUPER_ADMIN"
  | "CLINIC_ADMIN"
  | "DOCTOR"
  | "SECRETARY"
  | "AUDITOR"
  | "PATIENT";

const ROLE_ALIAS: Record<string, ComplianceRole> = {
  super_admin: "SUPER_ADMIN",
  clinic_owner: "CLINIC_ADMIN",
  clinic_admin: "CLINIC_ADMIN",
  admin: "CLINIC_ADMIN",
  doctor: "DOCTOR",
  medico: "DOCTOR",
  secretaria: "SECRETARY",
  recepcionista: "SECRETARY",
  receptionist: "SECRETARY",
  auditor: "AUDITOR",
  patient: "PATIENT",
};

export function normalizeComplianceRole(role: string | null | undefined): ComplianceRole | null {
  if (!role) return null;
  return ROLE_ALIAS[String(role).trim().toLowerCase()] ?? null;
}

export function isRoleAllowed(role: string | null | undefined, allowed: ComplianceRole[]): boolean {
  const normalized = normalizeComplianceRole(role);
  return normalized ? allowed.includes(normalized) : false;
}
