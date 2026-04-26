#!/usr/bin/env python
"""Seed idempotente de usuarios internos con password hasheada."""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

from sqlalchemy import select

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(str(project_root))

from api.app.core.security import get_password_hash
from api.app.db.session import async_session_local, engine
from api.app.models import Base, Doctor, User, UserRole


def _configure_windows_event_loop() -> None:
    """Usa SelectorEventLoop en Windows para compatibilidad con psycopg async."""
    if sys.platform.startswith("win") and hasattr(asyncio, "WindowsSelectorEventLoopPolicy"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


async def _ensure_user(session, *, username: str, plain_password: str, role: UserRole, doctor_id=None) -> None:
    stmt = select(User).where(User.username == username)
    existing = (await session.execute(stmt)).scalars().first()

    hashed_password = get_password_hash(plain_password)

    if existing:
        existing.hashed_password = hashed_password
        existing.role = role
        existing.is_active = True
        existing.doctor_id = doctor_id
        return

    session.add(
        User(
            id=uuid.uuid4(),
            username=username,
            hashed_password=hashed_password,
            role=role,
            is_active=True,
            doctor_id=doctor_id,
        )
    )


async def seed_users() -> None:
    admin_username = os.getenv("SEED_ADMIN_USERNAME", "admin")
    admin_password = os.getenv("SEED_ADMIN_PASSWORD")
    doctor_username = os.getenv("SEED_DOCTOR_USERNAME", "doctor")
    doctor_password = os.getenv("SEED_DOCTOR_PASSWORD")

    if not admin_password or not doctor_password:
        raise RuntimeError(
            "Faltan variables requeridas: SEED_ADMIN_PASSWORD y SEED_DOCTOR_PASSWORD. "
            "No se permiten credenciales por defecto."
        )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_local() as session:
        doctor = (await session.execute(select(Doctor).where(Doctor.is_active.is_(True)).limit(1))).scalars().first()
        doctor_id = doctor.id if doctor else None

        await _ensure_user(
            session,
            username=admin_username,
            plain_password=admin_password,
            role=UserRole.ADMIN,
        )
        await _ensure_user(
            session,
            username=doctor_username,
            plain_password=doctor_password,
            role=UserRole.DOCTOR,
            doctor_id=doctor_id,
        )

        await session.commit()

    print("Seed usuarios completado")
    print(f"admin={admin_username}")
    print(f"doctor={doctor_username} doctor_id={doctor_id}")


if __name__ == "__main__":
    try:
        _configure_windows_event_loop()
        asyncio.run(seed_users())
    except Exception as exc:
        print(f"Error en seed_users: {exc}")
        raise
