"""Dependencias de autorizacion (RBAC y ownership)."""

from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, status

from api.app.core.security import UserAuth, get_current_user


class RoleChecker:
    """Valida que el usuario autenticado tenga uno de los roles permitidos."""

    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = set(allowed_roles)

    def __call__(self, user: UserAuth = Depends(get_current_user)) -> UserAuth:
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos suficientes para esta accion",
            )
        return user


def enforce_doctor_ownership(user: UserAuth, doctor_id: UUID) -> None:
    """Evita que un doctor acceda citas de otro doctor."""

    if user.role != "doctor":
        return

    if not user.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario doctor no tiene doctor_id asociado",
        )

    if user.doctor_id != str(doctor_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes acceder a citas de otro doctor",
        )
