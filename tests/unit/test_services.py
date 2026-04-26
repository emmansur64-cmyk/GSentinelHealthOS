"""
Tests unitarios para servicios
"""

import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from shared.models import Base, Patient, Doctor
from shared.schemas import PatientCreate, DoctorCreate
from api.app.services.patient_service import PatientService
from api.app.services.doctor_service import DoctorService


@pytest.fixture
def db_session():
    """Fixture para sesión de BD de test"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()


class TestPatientService:
    """Tests para PatientService"""
    
    def test_create_patient(self, db_session):
        """Debe crear un paciente correctamente"""
        service = PatientService(db_session)
        
        patient_data = PatientCreate(
            name="Juan Prueba",
            email="juan@test.com",
            phone="+34612345678"
        )
        
        patient = service.create_patient(patient_data)
        
        assert patient.id is not None
        assert patient.name == "Juan Prueba"
        assert patient.email == "juan@test.com"
    
    def test_create_patient_duplicate_email(self, db_session):
        """Debe fallar si el email ya existe"""
        service = PatientService(db_session)
        
        patient_data = PatientCreate(
            name="Juan Prueba",
            email="juan@test.com",
            phone="+34612345678"
        )
        
        # Crear primero
        service.create_patient(patient_data)
        
        # Intentar crear con el mismo email
        with pytest.raises(ValueError, match="ya existe"):
            service.create_patient(patient_data)
    
    def test_get_patient(self, db_session):
        """Debe obtener un paciente por ID"""
        service = PatientService(db_session)
        
        patient_data = PatientCreate(
            name="Juan Prueba",
            email="juan@test.com"
        )
        created = service.create_patient(patient_data)
        
        retrieved = service.get_patient(created.id)
        
        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.email == "juan@test.com"
    
    def test_get_patient_not_found(self, db_session):
        """Debe retornar None si el paciente no existe"""
        service = PatientService(db_session)
        
        patient = service.get_patient(999)
        
        assert patient is None
    
    def test_list_patients(self, db_session):
        """Debe listar todos los pacientes"""
        service = PatientService(db_session)
        
        for i in range(3):
            patient_data = PatientCreate(
                name=f"Paciente {i}",
                email=f"paciente{i}@test.com"
            )
            service.create_patient(patient_data)
        
        patients = service.list_patients()
        
        assert len(patients) == 3
    
    def test_update_patient(self, db_session):
        """Debe actualizar los datos de un paciente"""
        service = PatientService(db_session)
        
        patient_data = PatientCreate(
            name="Juan Original",
            email="juan@test.com"
        )
        created = service.create_patient(patient_data)
        
        from shared.schemas import PatientUpdate
        update_data = PatientUpdate(name="Juan Actualizado")
        
        updated = service.update_patient(created.id, update_data)
        
        assert updated is not None
        assert updated.name == "Juan Actualizado"
        assert updated.email == "juan@test.com"  # No cambió
    
    def test_delete_patient(self, db_session):
        """Debe eliminar un paciente"""
        service = PatientService(db_session)
        
        patient_data = PatientCreate(
            name="Juan Temporal",
            email="juan@test.com"
        )
        created = service.create_patient(patient_data)
        
        result = service.delete_patient(created.id)
        
        assert result is True
        
        # Verificar que fue eliminado
        retrieved = service.get_patient(created.id)
        assert retrieved is None


class TestDoctorService:
    """Tests para DoctorService"""
    
    def test_create_doctor(self, db_session):
        """Debe crear un doctor correctamente"""
        service = DoctorService(db_session)
        
        doctor_data = DoctorCreate(
            name="Dr. Fernando",
            email="fernando@hospital.com",
            specialty="Cardiología",
            license_number="MAT-001"
        )
        
        doctor = service.create_doctor(doctor_data)
        
        assert doctor.id is not None
        assert doctor.name == "Dr. Fernando"
        assert doctor.specialty == "Cardiología"
    
    def test_list_doctors_by_specialty(self, db_session):
        """Debe listar doctores por especialidad"""
        service = DoctorService(db_session)
        
        # Crear doctores de diferentes especialidades
        for specialty in ["Cardiología", "Medicina General", "Cardiología"]:
            doctor_data = DoctorCreate(
                name=f"Dr. {specialty}",
                email=f"doctor{specialty}@hospital.com",
                specialty=specialty,
                license_number=f"MAT-{specialty[:3]}"
            )
            service.create_doctor(doctor_data)
        
        cardios = service.list_doctors_by_specialty("Cardiología")
        
        assert len(cardios) == 2
        assert all(d.specialty == "Cardiología" for d in cardios)
    
    def test_create_doctor_invalid_license(self, db_session):
        """Debe fallar con licencia inválida"""
        service = DoctorService(db_session)
        
        doctor_data = DoctorCreate(
            name="Dr. Inválido",
            email="invalido@hospital.com",
            specialty="Medicina",
            license_number="XX"  # Muy corto
        )
        
        with pytest.raises(ValueError, match="Número de matrícula"):
            service.create_doctor(doctor_data)
