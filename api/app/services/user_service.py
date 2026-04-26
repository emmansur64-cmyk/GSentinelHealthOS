"""Servicio de autenticacion y gestion de usuarios internos."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.security import verify_password
from api.app.models import User


class UserService:
    """Lógica de autenticación para credenciales de staff."""

    @staticmethod
    async def get_by_username(db: AsyncSession, username: str) -> Optional[User]:
        stmt = select(User).where(User.username == username)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def authenticate_user(db: AsyncSession, username: str, password: str) -> Optional[User]:
        user = await UserService.get_by_username(db, username)
        if not user or not user.is_active:
            return None

        if not verify_password(password, user.hashed_password):
            return None

        return user
