"""Dependencia central para resolver la clinica activa del usuario."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.security import UserAuth, get_current_user
from api.app.dependencies.db import get_db
from api.app.models import Clinic, ClinicMember, User
from shared.utils import setup_logger

logger = setup_logger(__name__)


@dataclass(frozen=True)
class ClinicContext:
    """Contexto tenant disponible para endpoints y servicios."""

    current_user: UserAuth
    current_clinic_id: UUID
    role: str


def _parse_clinic_id(raw_clinic_id: str | None) -> UUID:
    if not raw_clinic_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Clinic-Id es obligatorio para este endpoint",
        )
    try:
        return UUID(raw_clinic_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Clinic-Id invalido",
        ) from exc


async def get_clinic_context(
    x_clinic_id: str | None = Header(default=None, alias="X-Clinic-Id"),
    current_user: UserAuth = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClinicContext:
    """Valida clinica activa, usuario activo y membresia aprobada."""

    clinic_id = _parse_clinic_id(x_clinic_id)

    clinic = await db.get(Clinic, clinic_id)
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinica no encontrada")
    if not clinic.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clinica inactiva")

    user_conditions = [User.username == current_user.username]
    try:
        user_conditions.append(User.id == UUID(current_user.user_id))
    except ValueError:
        pass

    user = (
        await db.execute(
            select(User).where(or_(*user_conditions)).limit(1)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    if not user.is_active or not user.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")

    membership = (
        await db.execute(
            select(ClinicMember)
            .where(
                ClinicMember.clinic_id == clinic_id,
                ClinicMember.user_id == user.id,
            )
            .limit(1)
        )
    ).scalar_one_or_none()

    if membership is None or not membership.approved:
        logger.warning(
            "cross_clinic_access_denied",
            extra={
                "clinic_id": str(clinic_id),
                "user_id": str(user.id),
                "approved": getattr(membership, "approved", None),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no pertenece a la clinica o no esta aprobado",
        )

    return ClinicContext(
        current_user=current_user,
        current_clinic_id=clinic_id,
        role=membership.role.value if hasattr(membership.role, "value") else str(membership.role),
    )
