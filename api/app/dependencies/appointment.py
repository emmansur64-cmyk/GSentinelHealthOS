"""Dependencias para servicios."""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.dependencies.db import get_db
from api.app.services import AppointmentService


async def get_appointment_service(
    db: AsyncSession = Depends(get_db)
) -> AppointmentService:
    """Inyecta el servicio de citas con sesión DB."""
    return AppointmentService(db)
