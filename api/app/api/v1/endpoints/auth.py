"""Endpoints de autenticacion OAuth2 password flow."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.config import settings
from api.app.core.security import AUTH_COOKIE_NAME, UserAuth, create_access_token, get_current_user
from api.app.dependencies.db import get_db
from api.app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/token")
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
        samesite="lax",
        max_age=settings.jwt_expiration_hours * 3600,
        path="/",
    )
    return response


@router.post("/logout")
async def logout() -> JSONResponse:
    response = JSONResponse(status_code=status.HTTP_200_OK, content={"ok": True})
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")
    return response


@router.get("/session")
async def get_session(user: UserAuth = Depends(get_current_user)) -> dict:
    return {
        "authenticated": True,
        "username": user.username,
        "role": user.role,
        "doctor_id": user.doctor_id,
    }
