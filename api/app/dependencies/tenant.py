"""Dependencias para contexto tenant (client_id / clinic_id)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status

from api.app.core.security import (
    AUTH_COOKIE_NAME,
    UserAuth,
    get_current_user,
    get_current_user_optional,
    verify_jwt_token,
)


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


def _extract_bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization")
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]

    cookie_token = request.cookies.get(AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    return None


def resolve_request_tenant_context(request: Request) -> TenantContext:
    """Resuelve tenant desde headers y JWT sin requerir dependencias de endpoint."""
    header_client_id = _parse_optional_uuid(request.headers.get("x-client-id"), "X-Client-Id")
    header_clinic_id = _parse_optional_uuid(request.headers.get("x-clinic-id"), "X-Clinic-Id")

    token_client_id: UUID | None = None
    token_clinic_id: UUID | None = None

    token = _extract_bearer_token(request)
    if token:
        try:
            token_data = verify_jwt_token(token)
            token_client_id = _parse_optional_uuid(token_data.client_id, "token.client_id")
            token_clinic_id = _parse_optional_uuid(token_data.clinic_id, "token.clinic_id")
        except HTTPException:
            # Si el endpoint requiere auth, la dependencia de auth resolvera el rechazo.
            pass

    if header_client_id and token_client_id and header_client_id != token_client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="client_id del header no coincide con el token",
        )

    if header_clinic_id and token_clinic_id and header_clinic_id != token_clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="clinic_id del header no coincide con el token",
        )

    return TenantContext(
        client_id=header_client_id or token_client_id,
        clinic_id=header_clinic_id or token_clinic_id,
    )


async def get_tenant_context(
    request: Request,
    current_user: UserAuth = Depends(get_current_user),
) -> TenantContext:
    """Dependencia de tenant con autenticación JWT obligatoria."""
    resolved = resolve_request_tenant_context(request)

    user_client_id = _parse_optional_uuid(getattr(current_user, "client_id", None), "user.client_id")
    user_clinic_id = _parse_optional_uuid(getattr(current_user, "clinic_id", None), "user.clinic_id")

    if resolved.client_id and user_client_id and resolved.client_id != user_client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="client_id del header no coincide con el usuario autenticado",
        )

    if resolved.clinic_id and user_clinic_id and resolved.clinic_id != user_clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="clinic_id del header no coincide con el usuario autenticado",
        )

    return TenantContext(
        client_id=resolved.client_id or user_client_id,
        clinic_id=resolved.clinic_id or user_clinic_id,
    )


async def get_tenant_context_optional(
    request: Request,
    x_client_id: str | None = Header(default=None, alias="X-Client-Id"),
    x_clinic_id: str | None = Header(default=None, alias="X-Clinic-Id"),
    current_user: UserAuth | None = Depends(get_current_user_optional),
) -> TenantContext:
    # Fuerza parseo consistente de headers incluso cuando no hay JWT.
    _ = x_client_id
    _ = x_clinic_id

    resolved = resolve_request_tenant_context(request)
    header_client_id = resolved.client_id
    header_clinic_id = resolved.clinic_id

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
