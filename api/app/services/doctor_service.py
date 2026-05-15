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
    
    async def create_doctor(
        self,
        doctor_data: DoctorCreate,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> Doctor:
        """Crea un nuevo doctor."""
        logger.info("Creando doctor (nuevo registro)")

        if not validate_email(doctor_data.email):
            raise ValueError("Email inválido")

        if not validate_license_number(doctor_data.license_number):
            raise ValueError("Número de matrícula inválido")

        # Verificar que no exista
        existing_stmt = select(Doctor).where(Doctor.email == str(doctor_data.email))
        if client_id is not None and hasattr(Doctor, "client_id"):
            existing_stmt = existing_stmt.where(Doctor.client_id == client_id)
        if clinic_id is not None:
            existing_stmt = existing_stmt.where(Doctor.clinic_id == clinic_id)
        existing = (await self.db.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            raise ValueError("Doctor con ese email ya existe")
        
        db_doctor = Doctor(**doctor_data.model_dump())
        if client_id is not None and hasattr(db_doctor, "client_id"):
            db_doctor.client_id = client_id
        if clinic_id is not None:
            db_doctor.clinic_id = clinic_id
        self.db.add(db_doctor)
        await self.db.commit()
        await self.db.refresh(db_doctor)
        
        logger.info(f"✓ Doctor creado con ID: {db_doctor.id}")
        return db_doctor
    
    async def get_doctor(
        self,
        doctor_id: uuid.UUID,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> Optional[Doctor]:
        """Obtiene un doctor por ID."""
        stmt = select(Doctor).where(Doctor.id == doctor_id)
        if client_id is not None and hasattr(Doctor, "client_id"):
            stmt = stmt.where(Doctor.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Doctor.clinic_id == clinic_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()
    
    async def list_doctors(
        self,
        skip: int = 0,
        limit: int = 10,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> List[Doctor]:
        """Lista todos los doctores con paginación."""
        stmt = select(Doctor)
        if client_id is not None and hasattr(Doctor, "client_id"):
            stmt = stmt.where(Doctor.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Doctor.clinic_id == clinic_id)
        stmt = stmt.offset(skip).limit(limit)
        return list((await self.db.execute(stmt)).scalars().all())
    
    async def list_doctors_by_specialty(
        self,
        specialty: str,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> List[Doctor]:
        """Lista doctores por especialidad."""
        stmt = select(Doctor).where(Doctor.specialty == specialty)
        if client_id is not None and hasattr(Doctor, "client_id"):
            stmt = stmt.where(Doctor.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Doctor.clinic_id == clinic_id)
        return list((await self.db.execute(stmt)).scalars().all())
    
    async def update_doctor(
        self,
        doctor_id: uuid.UUID,
        doctor_data: DoctorUpdate,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> Optional[Doctor]:
        """Actualiza datos de un doctor."""
        db_doctor = await self.get_doctor(doctor_id, clinic_id=clinic_id, client_id=client_id)
        if not db_doctor:
            return None
        
        update_data = doctor_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_doctor, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_doctor)
        logger.info(f"✓ Doctor {doctor_id} actualizado")
        return db_doctor
    
    async def delete_doctor(
        self,
        doctor_id: uuid.UUID,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> bool:
        """Elimina un doctor."""
        db_doctor = await self.get_doctor(doctor_id, clinic_id=clinic_id, client_id=client_id)
        if not db_doctor:
            return False
        
        await self.db.delete(db_doctor)
        await self.db.commit()
        logger.info(f"✓ Doctor {doctor_id} eliminado")
        return True
