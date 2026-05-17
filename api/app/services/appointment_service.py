"""Service layer para lógica de citas - Fase 3.1 Crítica."""

from datetime import datetime, timedelta
from typing import Any, Optional, cast
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.phi_policy import PHIAccessType, phi_audit_log_enabled
from api.app.eventing.realtime_notifications import broadcast_realtime_event
from api.app.models import Appointment, Doctor, Patient
from api.app.models.models import PatientAccessLog
from api.app.services.outbox_service import OutboxService
from api.app.schemas import AppointmentCreate, AppointmentResponse
from shared.utils import setup_logger


logger = setup_logger(__name__)


class AppointmentService:
    """Servicio transaccional de citas con control de conflictos."""

    SLOT_BUFFER_MINUTES = 30  # Margen de verificación
    
    def __init__(self, db_session: AsyncSession):
        """Inicializa el servicio con sesión de BD."""
        self.db = db_session
        self.outbox_service = OutboxService(db_session)

    async def _publish_appointment_event(self, event_type: str, appointment: Appointment) -> None:
        payload = AppointmentResponse.model_validate(appointment).model_dump(mode="json")
        await broadcast_realtime_event(event_type, payload)

    @staticmethod
    def _sqlstate_from_exception(exc: BaseException) -> Optional[str]:
        """Extrae SQLSTATE si está disponible en el error de base de datos."""
        orig = getattr(exc, "orig", None)
        if orig is None:
            return None

        # psycopg/pg8000 exponen sqlstate; algunos drivers usan pgcode.
        sqlstate = getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None)
        if isinstance(sqlstate, str):
            return sqlstate
        return None
    
    async def create_appointment(
        self,
        appointment_data: AppointmentCreate,
        created_by: str = "api",
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> AppointmentResponse:
        """
        Crea una nueva cita con validación transaccional de conflictos.
        
        Args:
            appointment_data: Datos de la cita a crear
            created_by: Origen de la solicitud (gateway, dashboard, api)
        
        Returns:
            AppointmentResponse: Cita creada con ID
        
        Raises:
            HTTPException 409: Si hay conflicto de horarios
            HTTPException 404: Si doctor o paciente no existen
            HTTPException 400: Si la validación falla
        """
        
        # Flujo ACID con lock explícito para prevenir overbooking bajo concurrencia.
        try:
            if created_by == "gateway" and clinic_id is None:
                raise HTTPException(status_code=400, detail="clinic_id es obligatorio para turnos WhatsApp")

            await self.db.begin()

            # 1) Lock de doctor para serializar reservas por doctor.
            doctor_stmt = select(Doctor).where(Doctor.id == appointment_data.doctor_id)
            if client_id is not None and hasattr(Doctor, "client_id"):
                doctor_stmt = doctor_stmt.where(Doctor.client_id == client_id)
            if clinic_id is not None:
                doctor_stmt = doctor_stmt.where(Doctor.clinic_id == clinic_id)
            doctor_stmt = doctor_stmt.with_for_update()
            doctor_result = await self.db.execute(doctor_stmt)
            doctor = doctor_result.scalars().first()
            if not doctor:
                raise HTTPException(status_code=404, detail="Doctor o paciente no encontrado")
            if not cast(bool, doctor.is_active):
                raise HTTPException(status_code=400, detail="El doctor no está activo")

            patient_stmt = select(Patient).where(Patient.id == appointment_data.patient_id)
            if client_id is not None and hasattr(Patient, "client_id"):
                patient_stmt = patient_stmt.where(Patient.client_id == client_id)
            if clinic_id is not None and hasattr(Patient, "clinic_id"):
                patient_stmt = patient_stmt.where(Patient.clinic_id == clinic_id)
            patient_stmt = patient_stmt.with_for_update()
            patient_result = await self.db.execute(patient_stmt)
            patient = patient_result.scalars().first()
            if patient is None:
                raise HTTPException(status_code=404, detail="Doctor o paciente no encontrado")

            # 2) Verificación del slot con FOR UPDATE sobre citas existentes del slot.
            slot_stmt = (
                select(Appointment)
                .where(
                    and_(
                        Appointment.doctor_id == appointment_data.doctor_id,
                        Appointment.date_time == appointment_data.date_time,
                        Appointment.status != "cancelled",
                        Appointment.client_id == client_id if client_id is not None else True,
                        Appointment.clinic_id == clinic_id if clinic_id is not None else True,
                    )
                )
                .with_for_update()
            )
            slot_result = await self.db.execute(slot_stmt)
            existing_slot = slot_result.scalars().first()
            if existing_slot:
                raise HTTPException(
                    status_code=409,
                    detail="Slot ocupado: ya existe un turno para doctor_id/date_time"
                )

            # 3) Insert del turno dentro de la misma transacción.
            new_appointment = Appointment(
                client_id=client_id,
                clinic_id=clinic_id,
                doctor_id=appointment_data.doctor_id,
                patient_id=appointment_data.patient_id,
                date_time=appointment_data.date_time,
                reason=appointment_data.reason,
                status=appointment_data.status,
                created_by=created_by,
                source="whatsapp_ai" if created_by == "gateway" else created_by,
                specialty=getattr(doctor, "specialty", None),
                patient_full_name=getattr(patient, "full_name", None) or getattr(patient, "name", None),
                patient_dni=getattr(patient, "dni", None),
                patient_phone=getattr(patient, "phone", None),
                patient_email=getattr(patient, "email", None),
                patient_age=getattr(patient, "age", None),
                duration_minutes="30",
            )
            self.db.add(new_appointment)
            await self.db.flush()

            # Encola evento de notificación en la MISMA transacción.
            await self.outbox_service.enqueue_appointment_confirmation(
                appointment_id=cast(UUID, new_appointment.id),
                payload={
                    "appointment_id": str(cast(UUID, new_appointment.id)),
                    "doctor_id": str(cast(UUID, new_appointment.doctor_id)),
                    "patient_id": str(cast(UUID, new_appointment.patient_id)),
                    "date_time": cast(datetime, new_appointment.date_time).isoformat(),
                    "status": cast(str, new_appointment.status),
                    "created_by": created_by,
                },
            )

            await self.outbox_service.enqueue_google_create(
                appointment_id=cast(UUID, new_appointment.id),
                payload={
                    "appointment_id": str(cast(UUID, new_appointment.id)),
                    "action": "create",
                    "entity_type": "appointment",
                },
            )

            await self.db.commit()

            # Side effect externo SOLO despues del commit. Si Google falla,
            # la cita ya quedo confirmada y el outbox conserva retry/failure.
            try:
                await self.outbox_service.try_dispatch_google_create_after_commit(
                    appointment_id=cast(UUID, new_appointment.id)
                )
            except Exception:
                logger.warning(
                    "google_create_post_commit_dispatch_failed",
                    extra={"appointment_id": str(cast(UUID, new_appointment.id))},
                )

            await self.db.refresh(new_appointment)
            await self._publish_appointment_event("appointment_created", new_appointment)
            return AppointmentResponse.model_validate(new_appointment)

        except HTTPException:
            await self.db.rollback()
            raise
        
        except IntegrityError as e:
            await self.db.rollback()
            sqlstate = self._sqlstate_from_exception(e)
            if sqlstate == "23505":
                logger.warning(
                    "unique_violation al crear turno",
                    extra={
                        "event": "appointment_create_conflict",
                        "doctor_id": str(appointment_data.doctor_id),
                        "patient_id": str(appointment_data.patient_id),
                        "date_time": appointment_data.date_time.isoformat(),
                        "sqlstate": sqlstate,
                    },
                )
                raise HTTPException(
                    status_code=409,
                    detail="Slot ocupado: ya existe un turno para doctor_id/date_time"
                )
            if sqlstate == "23503":
                logger.info(
                    "foreign_key_violation al crear turno",
                    extra={
                        "event": "appointment_create_fk_not_found",
                        "doctor_id": str(appointment_data.doctor_id),
                        "patient_id": str(appointment_data.patient_id),
                        "date_time": appointment_data.date_time.isoformat(),
                        "sqlstate": sqlstate,
                    },
                )
                raise HTTPException(
                    status_code=404,
                    detail="Doctor o paciente no encontrado"
                )
            logger.exception(
                "IntegrityError no manejado al crear turno",
                extra={
                    "event": "appointment_create_integrity_error",
                    "doctor_id": str(appointment_data.doctor_id),
                    "patient_id": str(appointment_data.patient_id),
                    "date_time": appointment_data.date_time.isoformat(),
                    "sqlstate": sqlstate,
                },
            )
            raise HTTPException(
                status_code=500,
                detail="Error de integridad al crear cita"
            )
        except DBAPIError as e:
            await self.db.rollback()
            sqlstate = self._sqlstate_from_exception(e)

            # PostgreSQL serialization failure / deadlock -> conflicto concurrente reintentable.
            if sqlstate in {"40001", "40P01"}:
                raise HTTPException(
                    status_code=409,
                    detail="Conflicto transaccional concurrente al reservar cita; reintente"
                )

            logger.error("Error al crear cita (DBAPIError): %s", e, exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="Error interno del servidor"
            )
        except Exception as e:
            await self.db.rollback()
            logger.error("Error al crear cita: %s", e, exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="Error interno del servidor"
            )
    
    async def get_appointment(
        self,
        appointment_id: UUID,
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> Optional[AppointmentResponse]:
        """Obtiene una cita por ID."""
        stmt = select(Appointment).where(Appointment.id == appointment_id)
        if client_id is not None and hasattr(Appointment, "client_id"):
            stmt = stmt.where(Appointment.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Appointment.clinic_id == clinic_id)
        result = await self.db.execute(stmt)
        appointment = result.scalars().first()
        
        if not appointment:
            raise HTTPException(
                status_code=404,
                detail="Cita no encontrada"
            )
        
        return AppointmentResponse.model_validate(appointment)
    
    async def get_doctor_appointments(
        self,
        doctor_id: UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> list[AppointmentResponse]:
        """Obtiene citas de un doctor en un rango de fechas."""
        stmt = select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.status != "cancelled"  # Excluye canceladas
        )
        if client_id is not None and hasattr(Appointment, "client_id"):
            stmt = stmt.where(Appointment.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Appointment.clinic_id == clinic_id)
        
        if date_from and date_to:
            stmt = stmt.where(
                and_(
                    Appointment.date_time >= date_from,
                    Appointment.date_time <= date_to
                )
            )
        
        stmt = stmt.order_by(Appointment.date_time)
        result = await self.db.execute(stmt)
        appointments = result.scalars().all()
        
        return [AppointmentResponse.model_validate(a) for a in appointments]

    async def get_patient_appointments(
        self,
        patient_id: UUID,
        include_cancelled: bool = False,
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> list[AppointmentResponse]:
        """Obtiene citas de un paciente ordenadas por fecha."""
        stmt = select(Appointment).where(Appointment.patient_id == patient_id)
        if client_id is not None and hasattr(Appointment, "client_id"):
            stmt = stmt.where(Appointment.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Appointment.clinic_id == clinic_id)

        if not include_cancelled:
            stmt = stmt.where(Appointment.status != "cancelled")

        stmt = stmt.order_by(Appointment.date_time)
        result = await self.db.execute(stmt)
        appointments = result.scalars().all()

        return [AppointmentResponse.model_validate(a) for a in appointments]
    
    async def cancel_appointment(
        self,
        appointment_id: UUID,
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> AppointmentResponse:
        """Cancela una cita."""
        try:
            await self.db.begin()
            appointment = await self._get_appointment_by_id(
                appointment_id,
                client_id=client_id,
                clinic_id=clinic_id,
            )

            if cast(str, appointment.status) == "cancelled":
                raise HTTPException(
                    status_code=400,
                    detail="La cita ya estaba cancelada"
                )

            appointment.status = cast(Any, "cancelled")

            # PHI access audit — cancel modifica datos clínicos del paciente
            if phi_audit_log_enabled() and appointment.patient_id:
                try:
                    log_entry = PatientAccessLog(
                        patient_id=appointment.patient_id,
                        clinic_id=clinic_id,
                        client_id=client_id,
                        accessor_id="api",
                        accessor_role="api",
                        access_type=PHIAccessType.UPDATE,
                        resource_path=f"/api/v1/appointments/{appointment_id}/cancel",
                        success=True,
                    )
                    self.db.add(log_entry)
                except Exception as exc:
                    logger.warning("phi_access_log_appointment_cancel_failed", extra={"error": str(exc)})

            await self.outbox_service.enqueue_google_delete(
                appointment_id=cast(UUID, appointment.id),
                payload={
                    "appointment_id": str(cast(UUID, appointment.id)),
                    "action": "delete",
                    "entity_type": "appointment",
                },
            )
            await self.db.commit()

            # Sync externa post-commit. Si falla Google, no se revierte cancelacion.
            try:
                await self.outbox_service.try_dispatch_google_delete_after_commit(
                    appointment_id=cast(UUID, appointment.id)
                )
            except Exception:
                logger.warning(
                    "google_delete_post_commit_dispatch_failed",
                    extra={"appointment_id": str(cast(UUID, appointment.id))},
                )

            await self.db.refresh(appointment)
            await self._publish_appointment_event("appointment_cancelled", appointment)

            return AppointmentResponse.model_validate(appointment)
        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as exc:
            await self.db.rollback()
            logger.error("Error al cancelar cita: %s", exc, exc_info=True)
            raise HTTPException(status_code=500, detail="Error interno del servidor")

    async def confirm_appointment(
        self,
        appointment_id: UUID,
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> AppointmentResponse:
        """Confirma una cita (estado scheduled)."""
        appointment = await self._get_appointment_by_id(
            appointment_id,
            client_id=client_id,
            clinic_id=clinic_id,
        )
        if cast(str, appointment.status) == "cancelled":
            raise HTTPException(status_code=400, detail="No se puede confirmar una cita cancelada")

        appointment.status = cast(Any, "scheduled")
        await self.db.commit()
        await self.db.refresh(appointment)
        await self._publish_appointment_event("appointment_updated", appointment)
        return AppointmentResponse.model_validate(appointment)

    async def reschedule_appointment(
        self,
        appointment_id: UUID,
        new_date_time: datetime,
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> AppointmentResponse:
        """Reprograma una cita y valida conflictos de horario."""
        try:
            await self.db.begin()
            appointment = await self._get_appointment_by_id(
                appointment_id,
                client_id=client_id,
                clinic_id=clinic_id,
            )
            doctor_id = cast(UUID, appointment.doctor_id)

            if new_date_time <= datetime.utcnow():
                raise HTTPException(status_code=400, detail="La nueva fecha debe estar en el futuro")

            # Validar conflicto excluyendo la cita actual
            buffer = timedelta(minutes=self.SLOT_BUFFER_MINUTES)
            time_start = new_date_time - buffer
            time_end = new_date_time + buffer
            stmt = select(Appointment).where(
                and_(
                    Appointment.doctor_id == doctor_id,
                    Appointment.id != appointment_id,
                    Appointment.status != "cancelled",
                    Appointment.date_time >= time_start,
                    Appointment.date_time <= time_end,
                    Appointment.client_id == client_id if client_id is not None else True,
                    Appointment.clinic_id == clinic_id if clinic_id is not None else True,
                )
            ).with_for_update()
            result = await self.db.execute(stmt)
            conflicts = result.scalars().all()
            if conflicts:
                raise HTTPException(status_code=409, detail="Conflicto de horario para reprogramacion")

            appointment.date_time = cast(Any, new_date_time)
            appointment.status = cast(Any, "reprogrammed")
            await self.outbox_service.enqueue_google_update(
                appointment_id=cast(UUID, appointment.id),
                payload={
                    "appointment_id": str(cast(UUID, appointment.id)),
                    "action": "update",
                    "entity_type": "appointment",
                },
            )

            await self.db.commit()

            # Sync externa post-commit. Si falla Google, no se revierte reprogramacion.
            try:
                await self.outbox_service.try_dispatch_google_update_after_commit(
                    appointment_id=cast(UUID, appointment.id)
                )
            except Exception:
                logger.warning(
                    "google_update_post_commit_dispatch_failed",
                    extra={"appointment_id": str(cast(UUID, appointment.id))},
                )

            await self.db.refresh(appointment)
            await self._publish_appointment_event("appointment_updated", appointment)
            return AppointmentResponse.model_validate(appointment)
        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as exc:
            await self.db.rollback()
            logger.error("Error al reprogramar cita: %s", exc, exc_info=True)
            raise HTTPException(status_code=500, detail="Error interno del servidor")
    
    # ============ MÉTODOS PRIVADOS ============
    
    async def _verify_no_slot_conflict(
        self,
        doctor_id: UUID,
        appointment_time: datetime,
        use_row_lock: bool = True,
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> None:
        """
        Verifica que NO haya conflicto de horario para el médico.
        
        ⚠️ RACE CONDITION MITIGATION (Fase 3.3):
        Usa `with_for_update()` para aplicar row-level lock en PostgreSQL.
        Esto previene que dos transacciones lean "vacío" simultáneamente.
        
        Rango de verificación: ±SLOT_BUFFER_MINUTES (30 min por defecto)
        Ej: Si la cita es a las 14:00 con buffer 30min, verifica 13:30-14:30
        
        Args:
            doctor_id: UUID del médico
            appointment_time: Hora de la cita
            use_row_lock: Si True, aplica FOR UPDATE (PostgreSQL row-level lock)
        """
        buffer = timedelta(minutes=self.SLOT_BUFFER_MINUTES)
        
        # Calcular rango
        time_start = appointment_time - buffer
        time_end = appointment_time + buffer
        
        # Buscar citas solapadas (excluye canceladas)
        # CON ROW-LEVEL LOCK para evitar race conditions
        stmt = select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.status != "cancelled",
                Appointment.date_time >= time_start,
                Appointment.date_time <= time_end,
                Appointment.client_id == client_id if client_id is not None else True,
                Appointment.clinic_id == clinic_id if clinic_id is not None else True,
            )
        )
        
        # Aplicar FOR UPDATE (row-level lock en PostgreSQL)
        # Esto previene que otra transacción modifique estas filas
        if use_row_lock:
            stmt = stmt.with_for_update()
        
        result = await self.db.execute(stmt)
        conflicting_appointments = result.scalars().all()
        
        if conflicting_appointments:
            # Hay conflicto
            conflicting_times = [a.date_time for a in conflicting_appointments]
            raise HTTPException(
                status_code=409,
                detail=f"Conflicto de horario: El doctor tiene citas en {conflicting_times}. "
                        f"Rango de buffer: {self.SLOT_BUFFER_MINUTES} min. "
                        f"[Locked by AppointmentService._verify_no_slot_conflict]"
            )
    
    async def _get_doctor(
        self,
        doctor_id: UUID,
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> Optional[Doctor]:
        """Obtiene un doctor por ID (sin lanzar excepción)."""
        stmt = select(Doctor).where(Doctor.id == doctor_id)
        if client_id is not None and hasattr(Doctor, "client_id"):
            stmt = stmt.where(Doctor.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Doctor.clinic_id == clinic_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()
    
    async def _get_patient(
        self,
        patient_id: UUID,
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> Optional[Patient]:
        """Obtiene un paciente por ID (sin lanzar excepción)."""
        stmt = select(Patient).where(Patient.id == patient_id)
        if client_id is not None and hasattr(Patient, "client_id"):
            stmt = stmt.where(Patient.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Patient.clinic_id == clinic_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()
    
    async def _get_appointment_by_id(
        self,
        appointment_id: UUID,
        client_id: UUID | None = None,
        clinic_id: UUID | None = None,
    ) -> Appointment:
        """Obtiene una cita por ID (lanza 404 si no existe)."""
        stmt = select(Appointment).where(Appointment.id == appointment_id)
        if client_id is not None and hasattr(Appointment, "client_id"):
            stmt = stmt.where(Appointment.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Appointment.clinic_id == clinic_id)
        result = await self.db.execute(stmt)
        appointment = result.scalars().first()
        
        if not appointment:
            raise HTTPException(
                status_code=404,
                detail="Cita no encontrada"
            )
        
        return appointment
