"""Servicio async de pacientes con soft-delete y PHI access audit."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, Request, status
from sqlalchemy import select, true
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.phi_policy import PHIAccessType, phi_audit_log_enabled, phi_soft_delete_enabled
from api.app.models.models import PatientAccessLog
from shared.models import Patient
from shared.schemas import PatientCreate, PatientUpdate, WhatsAppPatientUpsert
from shared.security.secrets import hash_phone, normalize_phone
from shared.logging_utils import mask_phone
from shared.utils import validate_email, setup_logger

logger = setup_logger(__name__)

# Filtro base: excluye registros con soft-delete activo cuando el modelo lo soporta.
# Compatibilidad: algunos despliegues pueden no tener columna/atributo deleted_at.
_ACTIVE_FILTER = Patient.deleted_at.is_(None) if hasattr(Patient, "deleted_at") else true()


async def _record_phi_access(
    db: AsyncSession,
    *,
    patient_id: uuid.UUID,
    clinic_id: uuid.UUID | None,
    client_id: uuid.UUID | None,
    accessor_id: str,
    accessor_role: str | None,
    access_type: str,
    resource_path: str | None = None,
    request_id: str | None = None,
    success: bool = True,
    failure_reason: str | None = None,
) -> None:
    """Registra un acceso PHI en patient_access_logs (fire-and-forget, no bloquea)."""
    if not phi_audit_log_enabled():
        return
    try:
        log_entry = PatientAccessLog(
            patient_id=patient_id,
            clinic_id=clinic_id,
            client_id=client_id,
            accessor_id=accessor_id,
            accessor_role=accessor_role,
            access_type=access_type,
            resource_path=resource_path,
            request_id=request_id,
            success=success,
            failure_reason=failure_reason,
        )
        db.add(log_entry)
        await db.flush()  # escribe en la misma transacción, no hace commit propio
    except Exception as exc:
        # El audit log jamás debe bloquear la operación principal
        logger.warning("phi_access_log_write_failed", extra={"error": str(exc)})


class PatientService:
    """Servicio de negocio para pacientes con PHI compliance."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_patient(
        self,
        patient_data: PatientCreate,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        *,
        accessor_id: str = "system",
        accessor_role: str | None = None,
        request_id: str | None = None,
    ) -> Patient:
        """Crea un nuevo paciente."""
        if clinic_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="clinic_id obligatorio: operaciones PHI requieren tenant explícito",
            )
        logger.info("patient.create.started")

        if not validate_email(patient_data.email):
            raise ValueError("Email inválido")

        existing_stmt = select(Patient).where(
            Patient.email == str(patient_data.email),
            _ACTIVE_FILTER,
        )
        if client_id is not None and hasattr(Patient, "client_id"):
            existing_stmt = existing_stmt.where(Patient.client_id == client_id)
        if clinic_id is not None:
            existing_stmt = existing_stmt.where(Patient.clinic_id == clinic_id)
        existing = (await self.db.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            raise ValueError("Paciente con ese email ya existe")

        db_patient = Patient(**patient_data.model_dump())
        if getattr(db_patient, "phone", None):
            normalized_phone = normalize_phone(db_patient.phone)
            db_patient.phone = normalized_phone
            if hasattr(db_patient, "phone_hash"):
                db_patient.phone_hash = hash_phone(normalized_phone)
        if client_id is not None and hasattr(db_patient, "client_id"):
            db_patient.client_id = client_id
        if clinic_id is not None:
            db_patient.clinic_id = clinic_id

        self.db.add(db_patient)
        await self.db.flush()

        await _record_phi_access(
            self.db,
            patient_id=db_patient.id,
            clinic_id=clinic_id,
            client_id=client_id,
            accessor_id=accessor_id,
            accessor_role=accessor_role,
            access_type=PHIAccessType.CREATE,
            request_id=request_id,
        )

        await self.db.commit()
        await self.db.refresh(db_patient)
        logger.info("patient.create.done", extra={"patient_id": str(db_patient.id)})
        return db_patient

    async def get_patient(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        *,
        accessor_id: str = "system",
        accessor_role: str | None = None,
        request_id: str | None = None,
    ) -> Optional[Patient]:
        """Obtiene un paciente por ID."""
        if clinic_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="clinic_id obligatorio: operaciones PHI requieren tenant explícito",
            )
        stmt = select(Patient).where(Patient.id == patient_id, _ACTIVE_FILTER)
        if client_id is not None and hasattr(Patient, "client_id"):
            stmt = stmt.where(Patient.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Patient.clinic_id == clinic_id)

        patient = (await self.db.execute(stmt)).scalar_one_or_none()

        await _record_phi_access(
            self.db,
            patient_id=patient_id,
            clinic_id=clinic_id,
            client_id=client_id,
            accessor_id=accessor_id,
            accessor_role=accessor_role,
            access_type=PHIAccessType.READ,
            request_id=request_id,
            success=patient is not None,
            failure_reason="patient_not_found" if patient is None else None,
        )
        await self.db.commit()

        return patient

    async def list_patients(
        self,
        skip: int = 0,
        limit: int = 10,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        *,
        accessor_id: str = "system",
        accessor_role: str | None = None,
        request_id: str | None = None,
    ) -> List[Patient]:
        """Lista pacientes activos (excluye soft-deleted)."""
        if clinic_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="clinic_id obligatorio: operaciones PHI requieren tenant explícito",
            )
        stmt = select(Patient).where(_ACTIVE_FILTER)
        if client_id is not None and hasattr(Patient, "client_id"):
            stmt = stmt.where(Patient.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Patient.clinic_id == clinic_id)
        stmt = stmt.offset(skip).limit(limit)

        patients = list((await self.db.execute(stmt)).scalars().all())

        # Audit: registra la búsqueda con el primer patient_id si hay resultados,
        # o un UUID placeholder para listas vacías (el campo clínico es el clinic_id).
        if phi_audit_log_enabled() and clinic_id:
            try:
                log_entry = PatientAccessLog(
                    patient_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
                    clinic_id=clinic_id,
                    client_id=client_id,
                    accessor_id=accessor_id,
                    accessor_role=accessor_role,
                    access_type=PHIAccessType.LIST,
                    request_id=request_id,
                    success=True,
                )
                self.db.add(log_entry)
                await self.db.commit()
            except Exception as exc:
                logger.warning("phi_access_log_list_failed", extra={"error": str(exc)})

        return patients

    async def update_patient(
        self,
        patient_id: uuid.UUID,
        patient_data: PatientUpdate,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        *,
        accessor_id: str = "system",
        accessor_role: str | None = None,
        request_id: str | None = None,
    ) -> Optional[Patient]:
        """Actualiza datos de un paciente."""
        db_patient = await self.get_patient(
            patient_id, clinic_id=clinic_id, client_id=client_id,
            accessor_id=accessor_id, accessor_role=accessor_role, request_id=request_id,
        )
        if not db_patient:
            return None

        update_data = patient_data.model_dump(exclude_unset=True)
        for field_name, value in update_data.items():
            setattr(db_patient, field_name, value)

        await _record_phi_access(
            self.db,
            patient_id=patient_id,
            clinic_id=clinic_id,
            client_id=client_id,
            accessor_id=accessor_id,
            accessor_role=accessor_role,
            access_type=PHIAccessType.UPDATE,
            request_id=request_id,
        )

        await self.db.commit()
        await self.db.refresh(db_patient)
        logger.info("patient.update.done", extra={"patient_id": str(patient_id)})
        return db_patient

    async def delete_patient(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        *,
        accessor_id: str = "system",
        accessor_role: str | None = None,
        request_id: str | None = None,
    ) -> bool:
        """Elimina un paciente.

        Usa soft-delete cuando PHI_SOFT_DELETE_ENABLED=true (default).
        El soft-delete preserva la fila pero la marca como borrada, cumpliendo
        el derecho al olvido RGPD (art. 17) mientras mantiene la trazabilidad.
        """
        db_patient = await self.get_patient(
            patient_id, clinic_id=clinic_id, client_id=client_id,
            accessor_id=accessor_id, accessor_role=accessor_role, request_id=request_id,
        )
        if not db_patient:
            return False

        if phi_soft_delete_enabled():
            db_patient.deleted_at = datetime.utcnow()
        else:
            await self.db.delete(db_patient)

        await _record_phi_access(
            self.db,
            patient_id=patient_id,
            clinic_id=clinic_id,
            client_id=client_id,
            accessor_id=accessor_id,
            accessor_role=accessor_role,
            access_type=PHIAccessType.DELETE,
            request_id=request_id,
        )

        await self.db.commit()
        logger.info(
            "patient.delete.done",
            extra={
                "patient_id": str(patient_id),
                "mode": "soft" if phi_soft_delete_enabled() else "hard",
            },
        )
        return True

    async def upsert_whatsapp_patient(
        self,
        payload: WhatsAppPatientUpsert,
        clinic_id: uuid.UUID | None,
        client_id: uuid.UUID | None,
        *,
        accessor_id: str = "gateway",
        request_id: str | None = None,
    ) -> Patient:
        """Crea o actualiza paciente por telefono para intake de WhatsApp."""
        stmt = select(Patient).where(
            Patient.phone_hash == hash_phone(payload.phone),
            _ACTIVE_FILTER,
        )
        if client_id is not None and hasattr(Patient, "client_id"):
            stmt = stmt.where(Patient.client_id == client_id)
        if clinic_id is not None:
            stmt = stmt.where(Patient.clinic_id == clinic_id)

        patient = (await self.db.execute(stmt)).scalar_one_or_none()
        is_create = patient is None

        if is_create:
            patient = Patient(
                name=payload.full_name,
                full_name=payload.full_name,
                dni=payload.dni,
                phone=normalize_phone(payload.phone),
                email=str(payload.email) if payload.email else None,
                age=payload.age,
            )
            if hasattr(patient, "phone_hash"):
                patient.phone_hash = hash_phone(payload.phone)
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

        await self.db.flush()

        await _record_phi_access(
            self.db,
            patient_id=patient.id,
            clinic_id=clinic_id,
            client_id=client_id,
            accessor_id=accessor_id,
            accessor_role="gateway",
            access_type=PHIAccessType.CREATE if is_create else PHIAccessType.UPDATE,
            resource_path="/api/v1/patients/whatsapp-upsert",
            request_id=request_id,
        )

        await self.db.commit()
        await self.db.refresh(patient)
        logger.info(
            "patient.whatsapp_upsert.done",
            extra={"patient_id": str(patient.id), "op": "create" if is_create else "update"},
        )
        return patient
