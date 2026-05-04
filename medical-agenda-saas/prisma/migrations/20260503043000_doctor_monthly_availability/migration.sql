CREATE TABLE "doctor_availability_months" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "doctor_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_availability_months_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doctor_availability_slots" (
    "id" TEXT NOT NULL,
    "availability_month_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "doctor_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_availability_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doctor_availability_months_tenant_id_doctor_id_year_month_key" ON "doctor_availability_months"("tenant_id", "doctor_id", "year", "month");
CREATE INDEX "doctor_availability_months_tenant_id_year_month_idx" ON "doctor_availability_months"("tenant_id", "year", "month");
CREATE INDEX "doctor_availability_months_doctor_id_year_month_idx" ON "doctor_availability_months"("doctor_id", "year", "month");

CREATE UNIQUE INDEX "doctor_availability_slots_availability_month_id_date_start_time_e_key" ON "doctor_availability_slots"("availability_month_id", "date", "start_time", "end_time");
CREATE INDEX "doctor_availability_slots_tenant_id_doctor_id_date_idx" ON "doctor_availability_slots"("tenant_id", "doctor_id", "date");
CREATE INDEX "doctor_availability_slots_tenant_id_date_idx" ON "doctor_availability_slots"("tenant_id", "date");
CREATE INDEX "doctor_availability_slots_doctor_id_date_idx" ON "doctor_availability_slots"("doctor_id", "date");
CREATE INDEX "doctor_availability_slots_availability_month_id_date_idx" ON "doctor_availability_slots"("availability_month_id", "date");

ALTER TABLE "doctor_availability_months" ADD CONSTRAINT "doctor_availability_months_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doctor_availability_months" ADD CONSTRAINT "doctor_availability_months_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "doctor_availability_slots" ADD CONSTRAINT "doctor_availability_slots_availability_month_id_fkey" FOREIGN KEY ("availability_month_id") REFERENCES "doctor_availability_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctor_availability_slots" ADD CONSTRAINT "doctor_availability_slots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doctor_availability_slots" ADD CONSTRAINT "doctor_availability_slots_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;