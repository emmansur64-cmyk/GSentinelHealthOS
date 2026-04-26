-- 20260401_001_create_users_table.sql
-- Crea tabla de identidad para staff (separada de pacientes/shadow profiles)

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'doctor',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    doctor_id UUID NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_doctor_id ON users(doctor_id);

-- Enforce enum-like constraint de rol
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_users_role_valid'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT ck_users_role_valid
            CHECK (role IN ('admin', 'doctor', 'receptionist'));
    END IF;
END $$;
