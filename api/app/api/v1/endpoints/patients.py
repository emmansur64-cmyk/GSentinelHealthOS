"""Endpoints async para pacientes."""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.dependencies.db import get_db
from api.app.services.patient_service import PatientService
from api.app.services.shadow_profile_service import ShadowProfileService
from shared.schemas import PatientCreate, PatientUpdate, PatientResponse
from shared.utils import setup_logger

logger = setup_logger(__name__)
router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("/", response_model=PatientResponse, status_code=201)
async def create_patient(
    patient: PatientCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        service = PatientService(db)
        db_patient = await service.create_patient(patient)
        return db_patient
    except ValueError as e:
        logger.error(f"Error creando paciente: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error inesperado: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    service = PatientService(db)
    db_patient = await service.get_patient(patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return db_patient


@router.get("/", response_model=List[PatientResponse])
async def list_patients(
    skip: int = 0,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    service = PatientService(db)
    return await service.list_patients(skip=skip, limit=limit)


@router.get("/by-phone/{phone}", response_model=PatientResponse)
async def get_or_create_patient_by_phone(
    phone: str,
    create_if_missing: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """Lookup por telefono para Gateway; crea shadow profile si se solicita."""

    shadow_service = ShadowProfileService(db)
    if create_if_missing:
        patient = await shadow_service.get_or_create_by_phone(phone=phone)
    else:
        patient = await shadow_service.get_by_phone(phone=phone)
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")

    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: uuid.UUID,
    patient: PatientUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = PatientService(db)
    db_patient = await service.update_patient(patient_id, patient)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return db_patient


@router.delete("/{patient_id}", status_code=200, response_class=Response)
async def delete_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    service = PatientService(db)
    if not await service.delete_patient(patient_id):
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return None
