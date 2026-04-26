"""Servicio async de doctores."""

from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import Doctor
from shared.schemas import DoctorCreate, DoctorUpdate
from shared.utils import validate_email, validate_license_number, setup_logger

logger = setup_logger(__name__)


class DoctorService:
    """Servicio de negocio para doctores."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_doctor(self, doctor_data: DoctorCreate) -> Doctor:
        """Crea un nuevo doctor."""
        logger.info(f"Creando doctor: {doctor_data.email}")
        
        if not validate_email(doctor_data.email):
            raise ValueError(f"Email inválido: {doctor_data.email}")
        
        if not validate_license_number(doctor_data.license_number):
            raise ValueError("Número de matrícula inválido")
        
        # Verificar que no exista
        existing_stmt = select(Doctor).where(Doctor.email == str(doctor_data.email))
        existing = (await self.db.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            raise ValueError(f"Doctor con email {doctor_data.email} ya existe")
        
        db_doctor = Doctor(**doctor_data.model_dump())
        self.db.add(db_doctor)
        await self.db.commit()
        await self.db.refresh(db_doctor)
        
        logger.info(f"✓ Doctor creado con ID: {db_doctor.id}")
        return db_doctor
    
    async def get_doctor(self, doctor_id: uuid.UUID) -> Optional[Doctor]:
        """Obtiene un doctor por ID."""
        stmt = select(Doctor).where(Doctor.id == doctor_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()
    
    async def list_doctors(self, skip: int = 0, limit: int = 10) -> List[Doctor]:
        """Lista todos los doctores con paginación."""
        stmt = select(Doctor).offset(skip).limit(limit)
        return list((await self.db.execute(stmt)).scalars().all())
    
    async def list_doctors_by_specialty(self, specialty: str) -> List[Doctor]:
        """Lista doctores por especialidad."""
        stmt = select(Doctor).where(Doctor.specialty == specialty)
        return list((await self.db.execute(stmt)).scalars().all())
    
    async def update_doctor(
        self,
        doctor_id: uuid.UUID,
        doctor_data: DoctorUpdate
    ) -> Optional[Doctor]:
        """Actualiza datos de un doctor."""
        db_doctor = await self.get_doctor(doctor_id)
        if not db_doctor:
            return None
        
        update_data = doctor_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_doctor, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_doctor)
        logger.info(f"✓ Doctor {doctor_id} actualizado")
        return db_doctor
    
    async def delete_doctor(self, doctor_id: uuid.UUID) -> bool:
        """Elimina un doctor."""
        db_doctor = await self.get_doctor(doctor_id)
        if not db_doctor:
            return False
        
        await self.db.delete(db_doctor)
        await self.db.commit()
        logger.info(f"✓ Doctor {doctor_id} eliminado")
        return True
