"""
Endpoints de API para buffers automáticos entre turnos.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, date

from api.app.core.security import validate_hybrid_auth
from api.app.db.session import get_db
from api.app.models.time_slot_simple import TimeSlot
from api.app.services.buffer_service import BufferService
from api.app.schemas.buffer_schemas import (
    BufferBookingRequest,
    BufferBookingResponse,
    BufferCancellationRequest,
    BufferCancellationResponse,
    BufferImpactResponse,
    BufferIntegrityResponse,
)
from shared.utils import setup_logger

router = APIRouter(
    prefix="/slots",
    tags=["buffer_slots"]
)
logger = setup_logger(__name__)


def _raise_internal_error(operation: str, exc: Exception) -> None:
    logger.error("%s: %s", operation, exc, exc_info=True)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Error interno del servidor",
    )


@router.post(
    "/book-with-buffer",
    response_model=BufferBookingResponse,
    status_code=status.HTTP_200_OK,
    summary="Reservar slot con bloqueo automático de buffer",
    description="""
    Reserva un slot y bloquea automáticamente slots adyacentes según buffer del doctor.
    
    **Flujo:**
    1. Obtiene buffer_minutes del doctor
    2. Marca slot como 'booked'
    3. Crea appointment
    4. Bloquea slots anteriores y posteriores según buffer
    
    **Respuesta:**
    - success: bool - Operación exitosa
    - appointment_id: int - ID de cita creada
    - slots_blocked: int - Cantidad de slots adyacentes bloqueados
    - error: str - Mensaje si falló
    """
)
async def book_slot_with_buffer(
    request: BufferBookingRequest,
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    """Reservar slot con bloqueo automático de buffer."""
    try:
        slot = await db.scalar(select(TimeSlot).where(TimeSlot.id == request.slot_id))
        if slot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Slot not found"
            )

        # Obtener buffer del doctor si no se proporciona
        buffer_minutes = request.buffer_minutes
        if buffer_minutes == 0:
            buffer_minutes = await BufferService.get_doctor_buffer_minutes(
                db,
                doctor_id=slot.doctor_id
            )
        
        success, appointment_id, slots_blocked, error = await BufferService.book_slot_with_buffer(
            db=db,
            slot_id=request.slot_id,
            patient_id=request.patient_id,
            doctor_id=slot.doctor_id,
            buffer_minutes=buffer_minutes
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error or "Failed to book slot"
            )
        
        return BufferBookingResponse(
            success=True,
            appointment_id=appointment_id,
            slots_blocked=slots_blocked,
            error=""
        )
        
    except HTTPException:
        raise
    except Exception as e:
        _raise_internal_error("Error reservando slot con buffer", e)


@router.post(
    "/cancel-with-buffer-release",
    response_model=BufferCancellationResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancelar cita y liberar slots bloqueados",
    description="""
    Cancela una cita y libera inteligentemente los slots bloqueados por buffer.
    
    **Flujo:**
    1. Marca appointment como 'cancelled'
    2. Marca slot principal como 'available'
    3. Verifica que otros bookings no usen los buffers antes de liberar
    4. Libera slots que no sean usados por otras citas
    
    **Respuesta:**
    - success: bool - Operación exitosa
    - slot_id: int - ID del slot liberado
    - slots_unblocked: int - Cantidad de slots desbloqueados
    - error: str - Mensaje si falló
    """
)
async def cancel_with_buffer_release(
    request: BufferCancellationRequest,
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    """Cancelar cita y liberar slots bloqueados."""
    try:
        success, slot_id, slots_unblocked, error = await BufferService.cancel_appointment_with_buffer_release(
            db=db,
            appointment_id=request.appointment_id,
            buffer_minutes=request.buffer_minutes
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error or "Failed to cancel appointment"
            )
        
        return BufferCancellationResponse(
            success=True,
            slot_id=slot_id,
            slots_unblocked=slots_unblocked,
            error=""
        )
        
    except HTTPException:
        raise
    except Exception as e:
        _raise_internal_error("Error cancelando cita con buffer", e)


@router.get(
    "/available-excluding-buffers/{doctor_id}",
    response_model=list,  # List[AvailableSlotsResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar slots disponibles sin buffers",
    description="""
    Lista slots disponibles excluyendo los bloqueados por buffers.
    
    **Query params:**
    - slot_date: str - Fecha (YYYY-MM-DD)
    - include_blocked: bool - Incluir slots bloqueados (default: false)
    """
)
async def get_available_slots_excluding_buffers(
    doctor_id: int,
    slot_date: str,
    include_blocked: bool = False,
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    """Listar slots disponibles excluyendo buffers."""
    try:
        try:
            parsed_date = datetime.strptime(slot_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        slots = await BufferService.get_available_slots_excluding_buffers(
            db=db,
            doctor_id=doctor_id,
            slot_date=parsed_date,
            exclude_blocked=not include_blocked
        )
        
        result = [
            {
                "slot_id": slot.id,
                "doctor_id": slot.doctor_id,
                "start_time": slot.start_time.isoformat(),
                "end_time": slot.end_time.isoformat(),
                "status": slot.status,
                "is_buffer_affected": slot.status == "blocked"
            }
            for slot in slots
        ]
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        _raise_internal_error("Error listando slots disponibles sin buffers", e)


@router.get(
    "/buffer-impact/{doctor_id}",
    response_model=BufferImpactResponse,
    status_code=status.HTTP_200_OK,
    summary="Analizar impacto de buffers en disponibilidad",
    description="""
    Analiza cuánta capacidad se pierde por buffers.
    
    **Query params:**
    - slot_date: str - Fecha (YYYY-MM-DD, default: hoy)
    
    **Retorna:**
    - total_slots: Total de slots en la fecha
    - available: Slots disponibles
    - booked: Slots reservados
    - blocked_by_buffer: Slots bloqueados
    - buffer_impact_percent: % de reducción de disponibilidad
    - available_for_booking: Slots realmente disponibles para usuario
    """
)
async def get_buffer_impact(
    doctor_id: int,
    slot_date: str = None,
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    """Analizar impacto de buffers."""
    try:
        if slot_date is None:
            slot_date = datetime.now().date()
        else:
            try:
                slot_date = datetime.strptime(slot_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
        
        impact = await BufferService.analyze_buffer_impact(
            db=db,
            doctor_id=doctor_id,
            slot_date=slot_date
        )
        
        return BufferImpactResponse(**impact)
        
    except HTTPException:
        raise
    except Exception as e:
        _raise_internal_error("Error analizando impacto de buffers", e)


@router.get(
    "/buffer-integrity-check/{doctor_id}",
    response_model=BufferIntegrityResponse,
    status_code=status.HTTP_200_OK,
    summary="Validar integridad del sistema de buffers",
    description="""
    Verifica que no haya conflictos o inconsistencias en buffers.
    
    **Query params:**
    - slot_date: str - Fecha (YYYY-MM-DD, default: hoy)
    
    **Validaciones:**
    - orphan_blocked_slots: Slots bloqueados sin cita asociada
    - conflicting_buffers: Buffers solapados de múltiples citas
    """
)
async def check_buffer_integrity(
    doctor_id: int,
    slot_date: str = None,
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    """Validar integridad de buffers."""
    try:
        if slot_date is None:
            slot_date = datetime.now().date()
        else:
            try:
                slot_date = datetime.strptime(slot_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
        
        integrity = await BufferService.validate_buffer_integrity(
            db=db,
            doctor_id=doctor_id,
            slot_date=slot_date
        )
        
        return BufferIntegrityResponse(**integrity)
        
    except HTTPException:
        raise
    except Exception as e:
        _raise_internal_error("Error validando integridad de buffers", e)


@router.get(
    "/doctor-buffer-config/{doctor_id}",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Obtener configuración de buffer de un doctor",
    description="Retorna los minutos de buffer configurados para un doctor"
)
async def get_doctor_buffer_config(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(validate_hybrid_auth),
):
    """Obtener configuración de buffer."""
    try:
        buffer_minutes = await BufferService.get_doctor_buffer_minutes(
            db=db,
            doctor_id=doctor_id
        )
        
        return {
            "doctor_id": doctor_id,
            "buffer_minutes": buffer_minutes,
            "effective_date": datetime.now().isoformat()
        }
        
    except Exception as e:
        _raise_internal_error("Error obteniendo configuracion de buffer", e)
