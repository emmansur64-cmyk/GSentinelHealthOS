export interface DoctorPatientContext {
  doctor_id: string;
  patient_id: string;
  tenant_id?: string;
  clinic_id?: string;
  encounter_id?: string;
  appointment_id?: string;
}

export interface ActivePatientClinicalHistory {
  doctor_id: string;
  patient_id: string;
  tenant_id?: string;
  clinic_id?: string;
  encounter_id?: string;
  appointment_id?: string;
  clinical_summary: string;
  is_sanitized: boolean;
}

class ContractError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = code;
  }
}

export class InvalidDoctorPatientContextError extends ContractError {
  constructor(message = 'Invalid doctor-patient active context') {
    super('INVALID_DOCTOR_PATIENT_CONTEXT', message);
  }
}

export class PatientContextAccessDeniedError extends ContractError {
  constructor(message = 'Patient context access denied') {
    super('PATIENT_CONTEXT_ACCESS_DENIED', message);
  }
}
