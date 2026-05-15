export type DoctorContextLocale = {
  country: string;
  region: string | null;
  language: string;
  timezone: string;
};

export type DoctorContextPreferences = {
  clinicalStyle: string | null;
  preferredProtocols: string[];
  evidencePreference: string | null;
};

export type DoctorContextInput = {
  tenantId: string;
  doctorUserId: string;
  metadata?: Record<string, unknown> | null;
  hasRetrievalEvidence: boolean;
  hasRuntimeContext: boolean;
};

export type DoctorProfileContext = {
  instruction: string;
  scope: {
    tenantId: string;
    doctorUserId: string;
  };
  doctor: {
    name: string | null;
    specialty: string;
    experience: string | null;
  };
  clinic: {
    name: string | null;
  };
  locale: DoctorContextLocale;
  specialtyContext: string[];
  regionalGuidelines: string[];
  preferences: DoctorContextPreferences;
  compatibility: {
    retrieval: "available" | "not_available";
    runtimeContext: "available" | "not_available";
  };
  isolation: {
    tenantScoped: true;
    doctorScoped: true;
    sharesAcrossTenants: false;
  };
  fallback: boolean;
  errors: string[];
};
