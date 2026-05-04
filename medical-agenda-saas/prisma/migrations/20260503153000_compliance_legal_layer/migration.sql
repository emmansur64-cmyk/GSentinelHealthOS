-- Compliance legal layer (Argentina/Mendoza) - additive, reversible-safe migration

DO $$ BEGIN
  CREATE TYPE "ConsentAppliesTo" AS ENUM ('AI_ASSISTANT', 'TELEMEDICINE', 'WHATSAPP', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConsentChannel" AS ENUM ('WEB', 'WHATSAPP', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClinicalRecordType" AS ENUM ('CONSULTATION', 'AI_TRIAGE', 'NOTE', 'PRESCRIPTION', 'ATTACHMENT', 'WHATSAPP_SUMMARY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClinicalRecordSource" AS ENUM ('MANUAL', 'AI', 'WHATSAPP', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClinicalRecordStatus" AS ENUM ('DRAFT', 'SIGNED', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'CONSENT_ACCEPT', 'CONSENT_REVOKE', 'AI_ACCESS', 'SECURITY_DENIED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DataRequestType" AS ENUM ('EXPORT', 'RECTIFICATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DataRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'auditor';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'patient';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "action_type" "AuditAction";
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "patient_id" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ip_address" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "metadata_json" JSONB;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "hash" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "previous_hash" TEXT;

DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "audit_logs_action_type_created_at_idx" ON "audit_logs"("action_type", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_patient_id_created_at_idx" ON "audit_logs"("patient_id", "created_at");

CREATE TABLE IF NOT EXISTS "consent_templates" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "applies_to" "ConsentAppliesTo" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "consent_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "consent_templates_tenant_id_applies_to_version_key" ON "consent_templates"("tenant_id", "applies_to", "version");
CREATE INDEX IF NOT EXISTS "consent_templates_tenant_id_applies_to_active_idx" ON "consent_templates"("tenant_id", "applies_to", "active");

DO $$ BEGIN
  ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "patient_consents" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "patient_id" TEXT NOT NULL,
  "consent_template_id" TEXT NOT NULL,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "ip_address" TEXT,
  "user_agent" TEXT,
  "accepted_by_user_id" TEXT,
  "channel" "ConsentChannel" NOT NULL,
  "evidence_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_consents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patient_consents_tenant_id_patient_id_accepted_at_idx" ON "patient_consents"("tenant_id", "patient_id", "accepted_at");
CREATE INDEX IF NOT EXISTS "patient_consents_tenant_id_patient_id_revoked_at_idx" ON "patient_consents"("tenant_id", "patient_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "patient_consents_consent_template_id_idx" ON "patient_consents"("consent_template_id");

DO $$ BEGIN
  ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_consent_template_id_fkey"
  FOREIGN KEY ("consent_template_id") REFERENCES "consent_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_accepted_by_user_id_fkey"
  FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "clinical_records" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "patient_id" TEXT NOT NULL,
  "doctor_id" TEXT,
  "appointment_id" TEXT,
  "type" "ClinicalRecordType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "source" "ClinicalRecordSource" NOT NULL,
  "status" "ClinicalRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "signed_at" TIMESTAMP(3),
  "signed_by_user_id" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "voided_at" TIMESTAMP(3),
  "voided_reason" TEXT,
  "voided_by_user_id" TEXT,
  "hash" TEXT NOT NULL,
  "previous_hash" TEXT,
  CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "clinical_records_tenant_id_patient_id_created_at_idx" ON "clinical_records"("tenant_id", "patient_id", "created_at");
CREATE INDEX IF NOT EXISTS "clinical_records_tenant_id_appointment_id_idx" ON "clinical_records"("tenant_id", "appointment_id");
CREATE INDEX IF NOT EXISTS "clinical_records_tenant_id_status_created_at_idx" ON "clinical_records"("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "clinical_records_tenant_id_doctor_id_created_at_idx" ON "clinical_records"("tenant_id", "doctor_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_doctor_id_fkey"
  FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_signed_by_user_id_fkey"
  FOREIGN KEY ("signed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_voided_by_user_id_fkey"
  FOREIGN KEY ("voided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "patient_data_requests" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "patient_id" TEXT NOT NULL,
  "requested_by_user_id" TEXT,
  "request_type" "DataRequestType" NOT NULL,
  "status" "DataRequestStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "patient_data_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patient_data_req_tenant_patient_type_reqat_idx" ON "patient_data_requests"("tenant_id", "patient_id", "request_type", "requested_at");
CREATE INDEX IF NOT EXISTS "patient_data_requests_tenant_id_status_requested_at_idx" ON "patient_data_requests"("tenant_id", "status", "requested_at");

DO $$ BEGIN
  ALTER TABLE "patient_data_requests" ADD CONSTRAINT "patient_data_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patient_data_requests" ADD CONSTRAINT "patient_data_requests_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patient_data_requests" ADD CONSTRAINT "patient_data_requests_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
