from __future__ import annotations

from datetime import datetime, timedelta
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from api.app.core import settings
from api.app.dependencies.db import get_db
from api.app.models import ClientWhatsAppAccount, Clinic
from shared.security.secrets import MissingSecretEncryptionKeyError, SecretEncryptionError, encrypt_secret
from shared.utils import setup_logger

router = APIRouter(prefix="/meta", tags=["meta"])
logger = setup_logger(__name__)


def _safe_external_body(body: str, *, max_length: int = 500) -> str:
    redacted = str(body or "")
    for marker in ("access_token", "client_secret", "Authorization", "Bearer"):
        if marker in redacted:
            redacted = redacted.replace(marker, f"{marker}[redacted-key]")
    if len(redacted) > max_length:
        return f"{redacted[:max_length]}...[truncated]"
    return redacted


class EmbeddedSignupCallbackRequest(BaseModel):
    code: str
    state: str


class EmbeddedSignupCallbackResponse(BaseModel):
    status: str
    clinic_id: str
    phone_number_id: str
    waba_id: str | None = None
    meta_business_id: str | None = None
    display_phone_number: str | None = None


def _graph_base_url() -> str:
    version = (settings.meta_graph_api_version or "v21.0").strip().lstrip("/")
    return f"https://graph.facebook.com/{version}"


def _validate_meta_settings() -> None:
    missing = []
    if not settings.meta_app_id:
        missing.append("META_APP_ID")
    if not settings.meta_app_secret:
        missing.append("META_APP_SECRET")
    if not settings.meta_oauth_redirect_uri:
        missing.append("META_OAUTH_REDIRECT_URI")
    if missing:
        raise HTTPException(status_code=503, detail=f"Meta Embedded Signup no configurado: {', '.join(missing)}")


async def _exchange_code_for_token(code: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{_graph_base_url()}/oauth/access_token",
            params={
                "client_id": settings.meta_app_id,
                "client_secret": settings.meta_app_secret,
                "redirect_uri": settings.meta_oauth_redirect_uri,
                "code": code,
            },
        )

    if response.status_code >= 400:
        logger.warning(
            "meta_oauth_exchange_failed",
            extra={"status": response.status_code, "body": _safe_external_body(response.text)},
        )
        raise HTTPException(status_code=502, detail="No se pudo intercambiar el code de Meta")

    payload = response.json()
    if not payload.get("access_token"):
        raise HTTPException(status_code=502, detail="Meta no devolvio access_token")
    return payload


def _first_phone_from_businesses(payload: dict[str, Any]) -> dict[str, str | None] | None:
    businesses = (((payload.get("businesses") or {}).get("data")) or [])
    for business in businesses:
        wabas = ((business.get("owned_whatsapp_business_accounts") or {}).get("data")) or []
        for waba in wabas:
            phones = ((waba.get("phone_numbers") or {}).get("data")) or []
            for phone in phones:
                phone_number_id = str(phone.get("id") or "").strip()
                if phone_number_id:
                    return {
                        "meta_business_id": str(business.get("id") or "") or None,
                        "waba_id": str(waba.get("id") or "") or None,
                        "phone_number_id": phone_number_id,
                        "display_phone_number": str(phone.get("display_phone_number") or "") or None,
                    }
    return None


async def _get_signup_assets(access_token: str, token_payload: dict[str, Any]) -> dict[str, str | None]:
    direct_phone_number_id = str(token_payload.get("phone_number_id") or "").strip()
    if direct_phone_number_id:
        return {
            "meta_business_id": str(token_payload.get("business_id") or "") or None,
            "waba_id": str(token_payload.get("waba_id") or "") or None,
            "phone_number_id": direct_phone_number_id,
            "display_phone_number": str(token_payload.get("display_phone_number") or "") or None,
        }

    fields = (
        "id,name,"
        "businesses.limit(10){id,name,"
        "owned_whatsapp_business_accounts.limit(10){id,name,"
        "phone_numbers.limit(20){id,display_phone_number,verified_name}}}"
    )
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{_graph_base_url()}/me",
            params={"fields": fields, "access_token": access_token},
        )

    if response.status_code >= 400:
        logger.warning(
            "meta_assets_lookup_failed",
            extra={"status": response.status_code, "body": _safe_external_body(response.text)},
        )
        raise HTTPException(status_code=502, detail="No se pudieron obtener los activos WhatsApp de Meta")

    assets = _first_phone_from_businesses(response.json())
    if assets is None:
        raise HTTPException(status_code=502, detail="Meta no devolvio phone_number_id para Embedded Signup")
    return assets


def _token_expires_at(token_payload: dict[str, Any]) -> datetime | None:
    expires_in = token_payload.get("expires_in")
    if not expires_in:
        return None
    try:
        return datetime.utcnow() + timedelta(seconds=int(expires_in))
    except (TypeError, ValueError):
        return None


async def _handle_embedded_signup_callback(
    *,
    code: str,
    state: str,
    db: AsyncSession,
) -> EmbeddedSignupCallbackResponse:
    _validate_meta_settings()

    try:
        clinic_id = uuid.UUID(state)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="state debe ser un clinic_id UUID valido") from exc

    clinic = await db.get(Clinic, clinic_id)
    if clinic is None:
        raise HTTPException(status_code=404, detail="Clinica no encontrada")
    if not clinic.active or str(clinic.status or "").lower() not in {"active", "connected"}:
        raise HTTPException(status_code=409, detail="Clinica no esta activa")
    if clinic.client_id is None:
        raise HTTPException(status_code=409, detail="Clinica sin client_id asociado")

    token_payload = await _exchange_code_for_token(code.strip())
    access_token = str(token_payload["access_token"])
    assets = await _get_signup_assets(access_token, token_payload)

    try:
        access_token_encrypted = encrypt_secret(access_token)
        app_secret_encrypted = encrypt_secret(settings.meta_app_secret)
    except MissingSecretEncryptionKeyError as exc:
        raise HTTPException(status_code=503, detail="SECRET_ENCRYPTION_KEY faltante; no se puede guardar el token") from exc
    except SecretEncryptionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    phone_number_id = str(assets["phone_number_id"])
    existing = (
        await db.execute(
            select(ClientWhatsAppAccount).where(ClientWhatsAppAccount.phone_number_id == phone_number_id)
        )
    ).scalars().first()

    if existing is not None and existing.clinic_id not in (None, clinic_id):
        raise HTTPException(status_code=409, detail="phone_number_id ya conectado a otra clinica")

    account = existing or ClientWhatsAppAccount(
        client_id=clinic.client_id,
        clinic_id=clinic_id,
        phone_number_id=phone_number_id,
    )
    account.client_id = clinic.client_id
    account.clinic_id = clinic_id
    account.provider = "meta"
    account.phone_number = assets.get("display_phone_number") or account.phone_number
    account.display_phone_number = assets.get("display_phone_number")
    account.phone_number_id = phone_number_id
    account.business_account_id = assets.get("waba_id") or account.business_account_id
    account.meta_business_id = assets.get("meta_business_id")
    account.waba_id = assets.get("waba_id")
    account.access_token_encrypted = access_token_encrypted
    account.app_secret_encrypted = app_secret_encrypted
    account.webhook_enabled = True
    account.status = "connected"
    account.updated_at = datetime.utcnow()
    if _token_expires_at(token_payload) is not None:
        logger.info("meta_token_has_expiry", extra={"clinic_id": str(clinic_id), "phone_number_id": phone_number_id})

    db.add(account)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="phone_number_id already in use") from exc

    logger.info(
        "meta_embedded_signup_connected",
        extra={
            "clinic_id": str(clinic_id),
            "client_id": str(clinic.client_id),
            "phone_number_id": phone_number_id,
            "waba_id": assets.get("waba_id"),
            "meta_business_id": assets.get("meta_business_id"),
        },
    )

    return EmbeddedSignupCallbackResponse(
        status="success",
        clinic_id=str(clinic_id),
        phone_number_id=phone_number_id,
        waba_id=assets.get("waba_id"),
        meta_business_id=assets.get("meta_business_id"),
        display_phone_number=assets.get("display_phone_number"),
    )


@router.post("/embedded-signup/callback", response_model=EmbeddedSignupCallbackResponse)
async def embedded_signup_callback_post(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> EmbeddedSignupCallbackResponse:
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        raw = await request.json()
    elif "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        raw = dict(await request.form())
    else:
        raw = dict(request.query_params)

    payload = EmbeddedSignupCallbackRequest.model_validate(raw)
    code = payload.code
    state = payload.state
    if not code or not state:
        raise HTTPException(status_code=400, detail="code y state son obligatorios")
    return await _handle_embedded_signup_callback(code=code, state=state, db=db)


@router.get("/embedded-signup/callback", response_model=EmbeddedSignupCallbackResponse)
async def embedded_signup_callback_get(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> EmbeddedSignupCallbackResponse:
    return await _handle_embedded_signup_callback(code=code, state=state, db=db)
