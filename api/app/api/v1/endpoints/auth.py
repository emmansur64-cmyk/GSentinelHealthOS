"""Endpoints de autenticacion OAuth2 password flow."""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.config import settings
from api.app.core.security import (
    AUTH_COOKIE_NAME,
    AUTH_CSRF_COOKIE_NAME,
    UserAuth,
    create_access_token,
    get_current_user,
)
from api.app.dependencies.db import get_db
from api.app.services.user_service import UserService
from api.app.services.rate_limit import RedisRateLimiter, RateLimitDecision
from shared.utils import setup_logger

router = APIRouter(prefix="/auth", tags=["auth"])
logger = setup_logger(__name__)


def _request_identity(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    client = request.client
    if client and client.host:
        return client.host
    return "unknown"


async def _enforce_auth_rate_limit(request: Request) -> None:
    limiter: RedisRateLimiter | None = getattr(request.app.state, "auth_rate_limiter", None)
    if limiter is None:
        return

    decision: RateLimitDecision = await limiter.evaluate(_request_identity(request))
    if decision.allowed:
        return

    logger.warning("auth_rate_limit_exceeded")
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="rate_limit_exceeded",
        headers={
            "X-RateLimit-Limit": str(decision.limit),
            "X-RateLimit-Remaining": str(decision.remaining),
            "X-RateLimit-Reset": str(decision.reset_seconds),
            "Retry-After": str(decision.reset_seconds),
        },
    )


@router.post("/token", dependencies=[Depends(_enforce_auth_rate_limit)])
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Emite JWT de usuario para Swagger Authorize y clientes dashboard."""

    user = await UserService.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contrasena incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        {
            "sub": user.username,
            "username": user.username,
            "role": user.role.value,
            "doctor_id": str(user.doctor_id) if user.doctor_id else None,
            "client_id": str(user.client_id) if getattr(user, "client_id", None) else None,
            "clinic_id": str(user.clinic_id) if getattr(user, "clinic_id", None) else None,
            "scopes": ["appointment:read", "appointment:create", "user:read"],
        }
    )

    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip()
    secure_cookie = settings.auth_cookie_secure or forwarded_proto == "https" or request.url.scheme == "https"

    # Cookie de sesión HttpOnly: el frontend no accede al JWT.
    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"authenticated": True, "token_type": "bearer"},
    )
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=secure_cookie,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.jwt_expiration_hours * 3600,
        path="/",
    )
    response.set_cookie(
        key=AUTH_CSRF_COOKIE_NAME,
        value=secrets.token_urlsafe(32),
        httponly=False,
        secure=secure_cookie,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.jwt_expiration_hours * 3600,
        path="/",
    )
    return response


@router.post("/logout")
async def logout() -> JSONResponse:
    response = JSONResponse(status_code=status.HTTP_200_OK, content={"ok": True})
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")
    response.delete_cookie(key=AUTH_CSRF_COOKIE_NAME, path="/")
    return response


@router.get("/session")
async def get_session(user: UserAuth = Depends(get_current_user)) -> dict:
    return {
        "authenticated": True,
        "username": user.username,
        "role": user.role,
        "doctor_id": user.doctor_id,
        "client_id": user.client_id,
        "clinic_id": user.clinic_id,
    }
