"""Endpoints async para doctores."""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.security import validate_hybrid_auth
from api.app.dependencies.db import get_db
from api.app.dependencies.tenant import TenantContext, get_tenant_context_optional
from api.app.services.doctor_service import DoctorService
from shared.schemas import DoctorCreate, DoctorUpdate, DoctorResponse
from shared.utils import setup_logger

logger = setup_logger(__name__)
router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.post("/", response_model=DoctorResponse, status_code=201)
async def create_doctor(
    doctor: DoctorCreate,
    tenant: TenantContext = Depends(get_tenant_context_optional),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    try:
        service = DoctorService(db)
        db_doctor = await service.create_doctor(
            doctor,
            clinic_id=tenant.clinic_id,
            client_id=tenant.client_id,
        )
        return db_doctor
    except ValueError:
        raise HTTPException(status_code=400, detail="Datos invalidos")
    except Exception:
        logger.error("Error inesperado creando doctor")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@router.get("/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(
    doctor_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context_optional),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    service = DoctorService(db)
    db_doctor = await service.get_doctor(
        doctor_id,
        clinic_id=tenant.clinic_id,
        client_id=tenant.client_id,
    )
    if not db_doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return db_doctor


@router.get("/", response_model=List[DoctorResponse])
async def list_doctors(
    skip: int = 0,
    limit: int = 10,
    tenant: TenantContext = Depends(get_tenant_context_optional),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    service = DoctorService(db)
    return await service.list_doctors(
        skip=skip,
        limit=limit,
        clinic_id=tenant.clinic_id,
        client_id=tenant.client_id,
    )


@router.get("/specialty/{specialty}", response_model=List[DoctorResponse])
async def list_doctors_by_specialty(
    specialty: str,
    tenant: TenantContext = Depends(get_tenant_context_optional),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    service = DoctorService(db)
    return await service.list_doctors_by_specialty(
        specialty,
        clinic_id=tenant.clinic_id,
        client_id=tenant.client_id,
    )


@router.put("/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(
    doctor_id: uuid.UUID,
    doctor: DoctorUpdate,
    tenant: TenantContext = Depends(get_tenant_context_optional),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    service = DoctorService(db)
    db_doctor = await service.update_doctor(
        doctor_id,
        doctor,
        clinic_id=tenant.clinic_id,
        client_id=tenant.client_id,
    )
    if not db_doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return db_doctor


@router.delete("/{doctor_id}", status_code=200, response_class=Response)
async def delete_doctor(
    doctor_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context_optional),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
) -> None:
    service = DoctorService(db)
    if not await service.delete_doctor(
        doctor_id,
        clinic_id=tenant.clinic_id,
        client_id=tenant.client_id,
    ):
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return None
