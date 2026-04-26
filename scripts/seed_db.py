#!/usr/bin/env python
"""
Script de seed para popular la base de datos con datos de ejemplo
"""

import sys
import os
from datetime import datetime, timedelta

# Agregar raíz del proyecto al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from shared.models import Base, Patient, Doctor, Appointment, AppointmentStatus
from shared.config import DATABASE_URL
from shared.utils import setup_logger

logger = setup_logger(__name__)


def seed_database():
    """Seed de base de datos con datos de ejemplo"""
    
    logger.info("🌱 Iniciando seed de base de datos...")
    
    # Crear engine y sesión
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    try:
        # Crear tablas
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Tablas creadas")
        
        # Pacientes
        patients = [
            Patient(
                name="Juan Pérez García",
                email="juan.perez@example.com",
                phone="+34612345678",
                date_of_birth=datetime(1985, 3, 15),
                medical_history="Hipertensión controlada, Colesterol alto"
            ),
            Patient(
                name="María García López",
                email="maria.garcia@example.com",
                phone="+34698765432",
                date_of_birth=datetime(1990, 7, 22),
                medical_history="Alergia a la penicilina"
            ),
            Patient(
                name="Carlos López Rodríguez",
                email="carlos.lopez@example.com",
                phone="+34654321987",
                date_of_birth=datetime(1975, 11, 8),
                medical_history="Diabetes tipo 2, Control glicémico"
            ),
            Patient(
                name="Ana Martínez González",
                email="ana.martinez@example.com",
                phone="+34632145678",
                date_of_birth=datetime(1988, 5, 30),
                medical_history="Sin antecedentes relevantes"
            ),
            Patient(
                name="Fernando Sánchez Ruiz",
                email="fernando.sanchez@example.com",
                phone="+34656789012",
                date_of_birth=datetime(1980, 1, 12),
                medical_history="Asma leve"
            ),
        ]
        session.add_all(patients)
        session.commit()
        logger.info(f"✓ {len(patients)} pacientes creados")
        
        # Doctores
        doctors = [
            Doctor(
                name="Dr. Fernando Ruiz García",
                email="fernando.ruiz@hospital.com",
                specialty="Cardiología",
                phone="+34901234567",
                license_number="MAT-001-2020",
                is_active=1
            ),
            Doctor(
                name="Dra. Isabel Soler Martínez",
                email="isabel.soler@hospital.com",
                specialty="Medicina General",
                phone="+34902345678",
                license_number="MAT-002-2020",
                is_active=1
            ),
            Doctor(
                name="Dr. Miguel Rodríguez López",
                email="miguel.rodriguez@hospital.com",
                specialty="Endocrinología",
                phone="+34903456789",
                license_number="MAT-003-2020",
                is_active=1
            ),
            Doctor(
                name="Dra. Patricia González Flores",
                email="patricia.gonzalez@hospital.com",
                specialty="Alergología",
                phone="+34904567890",
                license_number="MAT-004-2020",
                is_active=1
            ),
            Doctor(
                name="Dr. Roberto Jiménez Acosta",
                email="roberto.jimenez@hospital.com",
                specialty="Neumología",
                phone="+34905678901",
                license_number="MAT-005-2020",
                is_active=1
            ),
            Doctor(
                name="Dra. Silvia Navarro Torres",
                email="silvia.navarro@hospital.com",
                specialty="Oftalmología",
                phone="+34906789012",
                license_number="MAT-006-2020",
                is_active=1
            ),
        ]
        session.add_all(doctors)
        session.commit()
        logger.info(f"✓ {len(doctors)} doctores creados")
        
        # Citas (ejemplo)
        appointments = [
            Appointment(
                patient_id=1,
                doctor_id=1,
                appointment_date=datetime.now() + timedelta(days=5, hours=10),
                reason="Chequeo cardiológico anual",
                status=AppointmentStatus.CONFIRMED.value
            ),
            Appointment(
                patient_id=2,
                doctor_id=2,
                appointment_date=datetime.now() + timedelta(days=3, hours=14),
                reason="Revisión general",
                status=AppointmentStatus.PENDING.value
            ),
            Appointment(
                patient_id=3,
                doctor_id=3,
                appointment_date=datetime.now() + timedelta(days=7, hours=9),
                reason="Control de diabetes",
                status=AppointmentStatus.CONFIRMED.value
            ),
            Appointment(
                patient_id=4,
                doctor_id=4,
                appointment_date=datetime.now() + timedelta(days=2, hours=16),
                reason="Prueba de alergia",
                status=AppointmentStatus.PENDING.value
            ),
            Appointment(
                patient_id=5,
                doctor_id=5,
                appointment_date=datetime.now() + timedelta(days=10, hours=11),
                reason="Revisión pulmonar",
                status=AppointmentStatus.PENDING.value
            ),
        ]
        session.add_all(appointments)
        session.commit()
        logger.info(f"✓ {len(appointments)} citas creadas")
        
        logger.info("✅ Seed completado correctamente")
        
    except Exception as e:
        logger.error(f"❌ Error durante seed: {str(e)}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    try:
        seed_database()
    except Exception as e:
        logger.error(f"Fatal: {str(e)}")
        sys.exit(1)
