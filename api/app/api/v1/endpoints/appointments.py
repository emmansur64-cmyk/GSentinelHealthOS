"""Endpoints de citas con seguridad híbrida (API Key + JWT) - Fase 3.2."""
from uuid import UUID
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Header, Query, Request
from pydantic import BaseModel, Field

from api.app.schemas import AppointmentCreate, AppointmentResponse
from api.app.services import AppointmentService, BookingQueueService
from api.app.dependencies.appointment import get_appointment_service
from api.app.dependencies.auth import RoleChecker, enforce_doctor_ownership
from api.app.eventing.realtime_notifications import broadcast_realtime_event
from api.app.core import (
    validate_hybrid_auth,
    check_permissions,
    validate_api_key,
    get_current_user,
)
router = APIRouter(
    prefix="/appointments",
    tags=["appointments"],
)


class RescheduleAppointmentRequest(BaseModel):
    new_date_time: datetime = Field(..., description="Nueva fecha/hora en ISO 8601")


# ============ ENDPOINTS HÍBRIDOS ============

@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Crear cita (Gateway + Dashboard)",
    description="Permite crear citas desde el Gateway de WhatsApp (API Key) o Dashboard (JWT)"
)
async def create_appointment(
    request: Request,
    appointment_data: AppointmentCreate,
    appointment_service: AppointmentService = Depends(get_appointment_service),
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
) -> AppointmentResponse:
    """
    Crea una nueva cita.
    
    **Autenticación Soportada:**
    - **API Key (Gateway/Brain):** Header `X-Internal-Key`
    - **JWT (Dashboard/Users):** Header `Authorization: Bearer <token>`
    
    **Lógica Transaccional:**
    - Verifica que el doctor y paciente existan
    - Verifica que NO haya conflicto de horarios (±30 min)
    - Si hay conflicto: 409 Conflict
    - Si es válido: Crea la cita en transacción atómica
    """
    
    # Validación híbrida
    auth_data = await validate_hybrid_auth(
        request=request,
        x_internal_key=x_internal_key,
        authorization=authorization
    )
    
    # Determinar origen
    created_by = "gateway" if auth_data["auth_type"] == "service" else "dashboard"
    
    # Crear cita (con transacción de slots + outbox)
    created = await appointment_service.create_appointment(
        appointment_data=appointment_data,
        created_by=created_by
    )

    await broadcast_realtime_event(
        "new_appointment",
        {
            "appointment_id": str(created.id),
            "doctor_id": str(created.doctor_id),
            "patient_id": str(created.patient_id),
            "status": created.status,
            "date_time": created.date_time.isoformat() if created.date_time else None,
            "source": created.source,
        },
    )

    return created


@router.post(
    "/queue/enqueue",
    response_model=Dict[str, Any],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue de reserva de cita (procesamiento asincrono)",
)
async def enqueue_appointment(
    request: Request,
    appointment_data: AppointmentCreate,
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
) -> Dict[str, Any]:
    auth_data = await validate_hybrid_auth(
        request=request,
        x_internal_key=x_internal_key,
        authorization=authorization,
    )
    created_by = "gateway" if auth_data["auth_type"] == "service" else "dashboard"

    service = BookingQueueService()
    return await service.enqueue(
        appointment_data=appointment_data,
        created_by=created_by,
        idempotency_key=idempotency_key,
    )


@router.get(
    "/queue/result/{request_id}",
    response_model=Dict[str, Any],
    summary="Consultar resultado de reserva encolada",
)
async def get_enqueue_result(
    request: Request,
    request_id: str,
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    await validate_hybrid_auth(
        request=request,
        x_internal_key=x_internal_key,
        authorization=authorization,
    )
    service = BookingQueueService()
    result = await service.get_result(request_id)
    if not result:
        raise HTTPException(status_code=404, detail="request_id no encontrado")
    return result


@router.get(
    "/patient/{patient_id}",
    response_model=List[AppointmentResponse],
    summary="Obtener citas de un paciente"
)
async def get_patient_appointments(
    request: Request,
    patient_id: UUID,
    include_cancelled: bool = Query(False),
    appointment_service: AppointmentService = Depends(get_appointment_service),
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
) -> List[AppointmentResponse]:
    """Obtiene las citas de un paciente para flujos internos del Brain."""

    await validate_hybrid_auth(
        request=request,
        x_internal_key=x_internal_key,
        authorization=authorization
    )

    return await appointment_service.get_patient_appointments(
        patient_id=patient_id,
        include_cancelled=include_cancelled,
    )


@router.get(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Obtener cita por ID"
)
async def get_appointment(
    request: Request,
    appointment_id: UUID,
    appointment_service: AppointmentService = Depends(get_appointment_service),
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
) -> AppointmentResponse:
    """Obtiene los detalles de una cita específica."""
    
    # Validación híbrida
    await validate_hybrid_auth(
        request=request,
        x_internal_key=x_internal_key,
        authorization=authorization
    )
    
    return await appointment_service.get_appointment(appointment_id)


@router.get(
    "/doctor/{doctor_id}",
    response_model=List[AppointmentResponse],
    summary="Obtener citas de un doctor"
)
async def get_doctor_appointments(
    request: Request,
    doctor_id: UUID,
    date_from: Optional[datetime] = Query(None, description="Fecha desde (ISO 8601)"),
    date_to: Optional[datetime] = Query(None, description="Fecha hasta (ISO 8601)"),
    appointment_service: AppointmentService = Depends(get_appointment_service),
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
) -> List[AppointmentResponse]:
    """
    Obtiene todas las citas de un doctor en un rango de fechas.
    """
    
    # Validación híbrida
    auth_data = await validate_hybrid_auth(
        request=request,
        x_internal_key=x_internal_key,
        authorization=authorization
    )

    # Ownership: un doctor autenticado solo puede ver sus propias citas.
    if auth_data.get("auth_type") == "user" and auth_data.get("role") == "doctor":
        token_doctor_id = auth_data.get("doctor_id")
        if not token_doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El token del doctor no contiene doctor_id",
            )
        if token_doctor_id != str(doctor_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes acceder a citas de otro doctor",
            )
    
    return await appointment_service.get_doctor_appointments(
        doctor_id=doctor_id,
        date_from=date_from,
        date_to=date_to
    )


@router.delete(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancelar cita"
)
async def cancel_appointment(
    request: Request,
    appointment_id: UUID,
    appointment_service: AppointmentService = Depends(get_appointment_service),
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
) -> AppointmentResponse:
    """
    Cancela una cita.
    """
    
    # Validación híbrida
    await validate_hybrid_auth(
        request=request,
        x_internal_key=x_internal_key,
        authorization=authorization
    )
    
    cancelled = await appointment_service.cancel_appointment(appointment_id)

    await broadcast_realtime_event(
        "cancel",
        {
            "appointment_id": str(cancelled.id),
            "doctor_id": str(cancelled.doctor_id),
            "patient_id": str(cancelled.patient_id),
            "status": cancelled.status,
            "date_time": cancelled.date_time.isoformat() if cancelled.date_time else None,
        },
    )

    return cancelled


@router.post(
    "/{appointment_id}/confirm",
    response_model=AppointmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirmar cita",
)
async def confirm_appointment(
    request: Request,
    appointment_id: UUID,
    appointment_service: AppointmentService = Depends(get_appointment_service),
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
) -> AppointmentResponse:
    await validate_hybrid_auth(request=request, x_internal_key=x_internal_key, authorization=authorization)
    return await appointment_service.confirm_appointment(appointment_id)


@router.post(
    "/{appointment_id}/reschedule",
    response_model=AppointmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Reprogramar cita",
)
async def reschedule_appointment(
    request: Request,
    appointment_id: UUID,
    payload: RescheduleAppointmentRequest,
    appointment_service: AppointmentService = Depends(get_appointment_service),
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
) -> AppointmentResponse:
    await validate_hybrid_auth(request=request, x_internal_key=x_internal_key, authorization=authorization)
    return await appointment_service.reschedule_appointment(
        appointment_id=appointment_id,
        new_date_time=payload.new_date_time,
    )


# ============ ENDPOINT ONLY-API-KEY ============

@router.post(
    "/gateway/validate-slot",
    response_model=Dict[str, Any],
    summary="Validar disponibilidad de slot (Gateway)",
    description="Endpoint interno: Solo para Gateway vía API Key"
)
async def validate_slot_gateway(
    doctor_id: UUID,
    appointment_time: datetime,
    appointment_service: AppointmentService = Depends(get_appointment_service),
    x_internal_key: str = Header(...),  # Requerido y no opcional
) -> Dict[str, Any]:
    """
    Valida si un doctor tiene disponibilidad en un horario.
    """
    
    # Validación SOLO de API Key (sin JWT)
    service_auth = await validate_api_key(x_internal_key)
    
    try:
        # Intenta verificar el slot (lanzará excepción si hay conflicto)
        await appointment_service._verify_no_slot_conflict(
            doctor_id=doctor_id,
            appointment_time=appointment_time
        )
        
        return {
            "available": True,
            "doctor_id": str(doctor_id),
            "appointment_time": appointment_time.isoformat(),
            "message": "Disponible"
        }
    
    except HTTPException as e:
        return {
            "available": False,
            "doctor_id": str(doctor_id),
            "appointment_time": appointment_time.isoformat(),
            "message": e.detail
        }


# ============ ENDPOINT ONLY-JWT ============

@router.get(
    "/my-appointments",
    response_model=List[AppointmentResponse],
    summary="Mis citas (Médico)",
    description="Endpoint para médicos autenticados con JWT"
)
async def get_my_appointments(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    appointment_service: AppointmentService = Depends(get_appointment_service),
    current_user = Depends(RoleChecker(["doctor", "admin", "receptionist"]))
) -> List[AppointmentResponse]:
    """
    Obtiene las citas del médico autenticado.
    """
    
    if current_user.role == "doctor":
        if not current_user.doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El usuario doctor no tiene doctor_id asociado",
            )
        doctor_id = UUID(current_user.doctor_id)
    else:
        # Admin/recepcion puede consultar sus citas propias solo si viene doctor_id en token.
        if not current_user.doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Este rol requiere doctor_id asociado para consultar mis citas",
            )
        doctor_id = UUID(current_user.doctor_id)

    enforce_doctor_ownership(current_user, doctor_id)
    
    return await appointment_service.get_doctor_appointments(
        doctor_id=doctor_id,
        date_from=start_date,
        date_to=end_date
    )

