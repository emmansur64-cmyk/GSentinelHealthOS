"""Servicio async de pacientes."""

from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import Patient
from shared.schemas import PatientCreate, PatientUpdate, WhatsAppPatientUpsert
from shared.utils import validate_email, setup_logger

logger = setup_logger(__name__)


class PatientService:
    """Servicio de negocio para pacientes."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_patient(
        self,
        patient_data: PatientCreate,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> Patient:
        """Crea un nuevo paciente."""
        logger.info(f"Creando paciente: {patient_data.email}")
        
        if not validate_email(patient_data.email):
            raise ValueError(f"Email inválido: {patient_data.email}")
        
        # Verificar que no exista
        existing_stmt = select(Patient).where(Patient.email == str(patient_data.email))
        if client_id is not None and hasattr(Patient, "client_id"):
            existing_stmt = existing_stmt.where(Patient.client_id == client_id)
        if clinic_id is not None:
            existing_stmt = existing_stmt.where(Patient.clinic_id == clinic_id)
        existing = (await self.db.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            raise ValueError(f"Paciente con email {patient_data.email} ya existe")
        
        db_patient = Patient(**patient_data.model_dump())
        if client_id is not None and hasattr(db_patient, "client_id"):
            db_patient.client_id = client_id
        if clinic_id is not None:
            db_patient.clinic_id = clinic_id
        self.db.add(db_patient)
        await self.db.commit()
        await self.db.refresh(db_patient)
        
        logger.info(f"✓ Paciente creado con ID: {db_patient.id}")
        return db_patient
    
    async def get_patient(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> Optional[Patient]:
        """Obtiene un paciente por ID."""
        stmt = select(Patient).where(Patient.id == patient_id)
        if client_id is not None and hasattr(Patient, "client_id"):
            stmt = stmt.where(Patient.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Patient.clinic_id == clinic_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()
    
    async def list_patients(
        self,
        skip: int = 0,
        limit: int = 10,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> List[Patient]:
        """Lista todos los pacientes con paginación."""
        stmt = select(Patient).offset(skip).limit(limit)
        if client_id is not None and hasattr(Patient, "client_id"):
            stmt = select(Patient).where(Patient.client_id == client_id).offset(skip).limit(limit)
        if clinic_id is not None:
            stmt = stmt.where(Patient.clinic_id == clinic_id)
        return list((await self.db.execute(stmt)).scalars().all())
    
    async def update_patient(
        self,
        patient_id: uuid.UUID,
        patient_data: PatientUpdate,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> Optional[Patient]:
        """Actualiza datos de un paciente."""
        db_patient = await self.get_patient(patient_id, clinic_id=clinic_id, client_id=client_id)
        if not db_patient:
            return None
        
        update_data = patient_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_patient, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_patient)
        logger.info(f"✓ Paciente {patient_id} actualizado")
        return db_patient
    
    async def delete_patient(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> bool:
        """Elimina un paciente."""
        db_patient = await self.get_patient(patient_id, clinic_id=clinic_id, client_id=client_id)
        if not db_patient:
            return False
        
        await self.db.delete(db_patient)
        await self.db.commit()
        logger.info(f"✓ Paciente {patient_id} eliminado")
        return True

    async def upsert_whatsapp_patient(
        self,
        payload: WhatsAppPatientUpsert,
        clinic_id: uuid.UUID | None,
        client_id: uuid.UUID | None,
    ) -> Patient:
        """Crea o actualiza paciente por telefono para intake de WhatsApp."""
        stmt = select(Patient).where(Patient.phone == payload.phone)
        if client_id is not None and hasattr(Patient, "client_id"):
            stmt = stmt.where(Patient.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Patient.clinic_id == clinic_id)

        patient = (await self.db.execute(stmt)).scalar_one_or_none()
        if patient is None:
            patient = Patient(
                name=payload.full_name,
                full_name=payload.full_name,
                dni=payload.dni,
                phone=payload.phone,
                email=str(payload.email) if payload.email else None,
                age=payload.age,
            )
            if client_id is not None and hasattr(patient, "client_id"):
                patient.client_id = client_id
            if clinic_id is not None:
                patient.clinic_id = clinic_id
            self.db.add(patient)
        else:
            patient.name = payload.full_name
            patient.full_name = payload.full_name
            patient.dni = payload.dni
            patient.age = payload.age
            if payload.email:
                patient.email = str(payload.email)

        await self.db.commit()
        await self.db.refresh(patient)
        return patient
