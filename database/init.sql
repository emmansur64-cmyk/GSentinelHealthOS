-- ============ TABLAS BASE ============

CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    date_of_birth TIMESTAMP,
    medical_history TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_name (name)
);

CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    license_number VARCHAR(50) UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_specialty (specialty),
    INDEX idx_license (license_number)
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    appointment_date TIMESTAMP NOT NULL,
    reason TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    
    INDEX idx_patient_id (patient_id),
    INDEX idx_doctor_id (doctor_id),
    INDEX idx_appointment_date (appointment_date),
    INDEX idx_status (status)
);


-- ============ DATOS DE EJEMPLO ============

INSERT INTO patients (name, email, phone, date_of_birth, medical_history)
VALUES
    ('Juan Pérez', 'juan.perez@example.com', '+34612345678', '1985-03-15', 'Hipertensión controlada'),
    ('María García', 'maria.garcia@example.com', '+34698765432', '1990-07-22', 'Alergia a la penicilina'),
    ('Carlos López', 'carlos.lopez@example.com', '+34654321987', '1975-11-08', 'Diabetes tipo 2'),
    ('Ana Martínez', 'ana.martinez@example.com', '+34632145678', '1988-05-30', 'Sin antecedentes relevantes')
ON CONFLICT DO NOTHING;

INSERT INTO doctors (name, email, specialty, phone, license_number, is_active)
VALUES
    ('Dr. Fernando Ruiz', 'fernando.ruiz@hospital.com', 'Cardiología', '+34901234567', 'MAT-001-2020', 1),
    ('Dra. Isabel Soler', 'isabel.soler@hospital.com', 'Medicina General', '+34902345678', 'MAT-002-2020', 1),
    ('Dr. Miguel Rodríguez', 'miguel.rodriguez@hospital.com', 'Endocrinología', '+34903456789', 'MAT-003-2020', 1),
    ('Dra. Patricia González', 'patricia.gonzalez@hospital.com', 'Alergología', '+34904567890', 'MAT-004-2020', 1)
ON CONFLICT DO NOTHING;


-- ============ ÍNDICES ADICIONALES ============

CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_doctors_email ON doctors(email);
