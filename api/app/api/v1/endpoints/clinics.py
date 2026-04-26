from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/clinics", tags=["clinics"])


class ClinicInitRequest(BaseModel):
    clinic_id: str = Field(..., min_length=2, max_length=64)
    clinic_name: str = Field(..., min_length=2, max_length=120)


class ClinicInitResponse(BaseModel):
    clinic_id: str
    clinic_name: str
    status: str
    initialized_at: str


@router.post("/init", response_model=ClinicInitResponse)
async def init_clinic(payload: ClinicInitRequest) -> ClinicInitResponse:
    clinic_id = payload.clinic_id.strip()
    clinic_name = payload.clinic_name.strip()

    if not clinic_id:
        raise HTTPException(status_code=400, detail="clinic_id es obligatorio")
    if not clinic_name:
        raise HTTPException(status_code=400, detail="clinic_name es obligatorio")

    return ClinicInitResponse(
        clinic_id=clinic_id,
        clinic_name=clinic_name,
        status="initialized",
        initialized_at=datetime.utcnow().isoformat(),
    )
