"""Servicio async de pacientes."""

from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import Patient
from shared.schemas import PatientCreate, PatientUpdate
from shared.utils import validate_email, setup_logger

logger = setup_logger(__name__)


class PatientService:
    """Servicio de negocio para pacientes."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_patient(self, patient_data: PatientCreate) -> Patient:
        """Crea un nuevo paciente."""
        logger.info(f"Creando paciente: {patient_data.email}")
        
        if not validate_email(patient_data.email):
            raise ValueError(f"Email inválido: {patient_data.email}")
        
        # Verificar que no exista
        existing_stmt = select(Patient).where(Patient.email == str(patient_data.email))
        existing = (await self.db.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            raise ValueError(f"Paciente con email {patient_data.email} ya existe")
        
        db_patient = Patient(**patient_data.model_dump())
        self.db.add(db_patient)
        await self.db.commit()
        await self.db.refresh(db_patient)
        
        logger.info(f"✓ Paciente creado con ID: {db_patient.id}")
        return db_patient
    
    async def get_patient(self, patient_id: uuid.UUID) -> Optional[Patient]:
        """Obtiene un paciente por ID."""
        stmt = select(Patient).where(Patient.id == patient_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()
    
    async def list_patients(self, skip: int = 0, limit: int = 10) -> List[Patient]:
        """Lista todos los pacientes con paginación."""
        stmt = select(Patient).offset(skip).limit(limit)
        return list((await self.db.execute(stmt)).scalars().all())
    
    async def update_patient(
        self,
        patient_id: uuid.UUID,
        patient_data: PatientUpdate
    ) -> Optional[Patient]:
        """Actualiza datos de un paciente."""
        db_patient = await self.get_patient(patient_id)
        if not db_patient:
            return None
        
        update_data = patient_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_patient, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_patient)
        logger.info(f"✓ Paciente {patient_id} actualizado")
        return db_patient
    
    async def delete_patient(self, patient_id: uuid.UUID) -> bool:
        """Elimina un paciente."""
        db_patient = await self.get_patient(patient_id)
        if not db_patient:
            return False
        
        await self.db.delete(db_patient)
        await self.db.commit()
        logger.info(f"✓ Paciente {patient_id} eliminado")
        return True
