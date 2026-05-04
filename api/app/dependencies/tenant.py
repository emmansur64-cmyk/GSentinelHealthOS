"""Dependencias para contexto tenant (client_id / clinic_id)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

from api.app.core.security import UserAuth, get_current_user_optional


@dataclass(frozen=True)
class TenantContext:
    client_id: UUID | None = None
    clinic_id: UUID | None = None


def _parse_uuid_or_raise(value: str, field_name: str) -> UUID:
    try:
        return UUID(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} inválido",
        ) from exc


def _parse_optional_uuid(value: str | None, field_name: str) -> UUID | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    return _parse_uuid_or_raise(normalized, field_name)


async def get_tenant_context_optional(
    x_client_id: str | None = Header(default=None, alias="X-Client-Id"),
    x_clinic_id: str | None = Header(default=None, alias="X-Clinic-Id"),
    current_user: UserAuth | None = Depends(get_current_user_optional),
) -> TenantContext:
    header_client_id = _parse_optional_uuid(x_client_id, "X-Client-Id")
    header_clinic_id = _parse_optional_uuid(x_clinic_id, "X-Clinic-Id")

    user_client_id = _parse_optional_uuid(getattr(current_user, "client_id", None), "user.client_id")
    user_clinic_id = _parse_optional_uuid(getattr(current_user, "clinic_id", None), "user.clinic_id")

    if header_client_id and user_client_id and header_client_id != user_client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="client_id del header no coincide con el usuario autenticado",
        )

    if header_clinic_id and user_clinic_id and header_clinic_id != user_clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="clinic_id del header no coincide con el usuario autenticado",
        )

    return TenantContext(
        client_id=header_client_id or user_client_id,
        clinic_id=header_clinic_id or user_clinic_id,
    )
