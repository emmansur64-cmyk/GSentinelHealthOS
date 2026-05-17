"""Endpoints exclusivos del Panel Super-Admin — requieren X-Internal-Key de panel-admin."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.security import InternalAuth, validate_api_key
from api.app.dependencies.db import get_db
from api.app.models import Client
from api.app.models.admin_models import AdminAuditLog, FeatureFlag
from shared.utils import setup_logger

router = APIRouter(prefix="/admin/panel", tags=["panel-admin"])
logger = setup_logger(__name__)

_ALLOWED_STATUSES = {"active", "suspended", "pending", "disabled", "trial"}

# ── Guardia de servicio ───────────────────────────────────────────────────────

def _require_panel_admin(auth: InternalAuth) -> None:
    """Bloquea cualquier servicio que no sea panel-admin."""
    if auth.service != "panel-admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Estos endpoints son exclusivos del servicio panel-admin",
        )


# ── Schemas ───────────────────────────────────────────────────────────────────

class PanelTenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan: str = "basico"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PanelTenantPatch(BaseModel):
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip() not in _ALLOWED_STATUSES:
            raise ValueError(f"status debe ser uno de: {sorted(_ALLOWED_STATUSES)}")
        return v.strip() if v else v


class PanelAuditLogEntry(BaseModel):
    id: uuid.UUID
    timestamp: datetime
    actor_id: str
    actor_email: str
    actor_role: str
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    status: str
    metadata_json: Optional[str] = None
    request_id: Optional[str] = None

    model_config = {"from_attributes": True}


class PanelAuditLogCreate(BaseModel):
    actor_id: str = Field(..., min_length=1, max_length=255)
    actor_email: str = Field(..., min_length=1, max_length=255)
    actor_role: str = Field(..., min_length=1, max_length=64)
    action: str = Field(..., min_length=1, max_length=64)
    resource_type: Optional[str] = Field(None, max_length=64)
    resource_id: Optional[str] = Field(None, max_length=255)
    status: str = Field(default="success", max_length=20)
    # metadata_json debe llegar pre-sanitizado desde el panel (sin PHI, sin tokens)
    metadata_json: Optional[str] = None
    request_id: Optional[str] = Field(None, max_length=128)
    ip_hash: Optional[str] = Field(None, max_length=64)


class PanelFeatureFlagResponse(BaseModel):
    key: str
    label: str
    description: Optional[str] = None
    enabled: bool
    scope: str
    module: Optional[str] = None
    updated_by: Optional[str] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class PanelFeatureFlagPatch(BaseModel):
    enabled: bool
    updated_by: str = Field(..., min_length=1, max_length=255)


# ── Helpers ───────────────────────────────────────────────────────────────────

_PHI_KEYS = {
    "password", "token", "secret", "api_key", "access_token",
    "phone", "email", "dni", "nombre", "name", "patient", "paciente",
}


def _sanitize_metadata(raw: Optional[str], max_bytes: int = 4096) -> Optional[str]:
    """Elimina claves sensibles y aplica límite de tamaño al JSON de metadata."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            data = {
                k: v
                for k, v in data.items()
                if not any(pk in k.lower() for pk in _PHI_KEYS)
            }
        result = json.dumps(data, ensure_ascii=False)
        if len(result.encode("utf-8")) > max_bytes:
            return json.dumps({"_truncated": True})
        return result
    except (json.JSONDecodeError, TypeError):
        return None


async def _write_audit_log(
    db: AsyncSession,
    *,
    actor_id: str,
    actor_email: str,
    actor_role: str,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    request_id: Optional[str] = None,
) -> None:
    """Registra un evento de auditoría. Fallos son logueados pero no bloquean la respuesta."""
    try:
        meta_json = _sanitize_metadata(json.dumps(metadata)) if metadata else None
        entry = AdminAuditLog(
            actor_id=actor_id,
            actor_email=actor_email,
            actor_role=actor_role,
            action=action.upper(),
            resource_type=resource_type,
            resource_id=resource_id,
            status="success",
            metadata_json=meta_json,
            request_id=request_id,
        )
        db.add(entry)
        await db.flush()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Audit log write failed (non-fatal): %s", exc)


# ── Tenants ───────────────────────────────────────────────────────────────────

@router.get("/tenants", response_model=list[PanelTenantResponse])
async def list_panel_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _auth: InternalAuth = Depends(validate_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[PanelTenantResponse]:
    _require_panel_admin(_auth)
    rows = list(
        (
            await db.execute(
                select(Client).order_by(Client.created_at.desc()).offset(skip).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [PanelTenantResponse.model_validate(row) for row in rows]


@router.patch("/tenants/{tenant_id}", response_model=PanelTenantResponse)
async def patch_panel_tenant(
    tenant_id: uuid.UUID,
    payload: PanelTenantPatch,
    _auth: InternalAuth = Depends(validate_api_key),
    db: AsyncSession = Depends(get_db),
) -> PanelTenantResponse:
    _require_panel_admin(_auth)

    row = await db.get(Client, tenant_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    changed: dict = {}
    if payload.status is not None:
        changed["status"] = {"prev": row.status, "new": payload.status}
        row.status = payload.status

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Conflicto al actualizar tenant") from exc

    await db.refresh(row)
    logger.info("Tenant updated by panel-admin", extra={"tenant_id": str(tenant_id), "changes": changed})
    return PanelTenantResponse.model_validate(row)


# ── Audit Logs ────────────────────────────────────────────────────────────────

@router.get("/audit-logs")
async def list_panel_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    action: Optional[str] = Query(None, max_length=64),
    _auth: InternalAuth = Depends(validate_api_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_panel_admin(_auth)

    base_stmt = select(AdminAuditLog)
    if action:
        base_stmt = base_stmt.where(AdminAuditLog.action == action.upper().strip())

    total: int = (await db.execute(select(func.count()).select_from(base_stmt.subquery()))).scalar() or 0

    offset = (page - 1) * limit
    rows = list(
        (await db.execute(base_stmt.order_by(AdminAuditLog.timestamp.desc()).offset(offset).limit(limit)))
        .scalars()
        .all()
    )

    return {
        "logs": [PanelAuditLogEntry.model_validate(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/audit-logs", response_model=PanelAuditLogEntry, status_code=201)
async def create_panel_audit_log(
    payload: PanelAuditLogCreate,
    _auth: InternalAuth = Depends(validate_api_key),
    db: AsyncSession = Depends(get_db),
) -> PanelAuditLogEntry:
    _require_panel_admin(_auth)

    entry = AdminAuditLog(
        actor_id=payload.actor_id,
        actor_email=payload.actor_email,
        actor_role=payload.actor_role,
        action=payload.action.upper().strip(),
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
        status=payload.status,
        metadata_json=_sanitize_metadata(payload.metadata_json),
        request_id=payload.request_id,
        ip_hash=payload.ip_hash,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return PanelAuditLogEntry.model_validate(entry)


# ── Feature Flags ─────────────────────────────────────────────────────────────

@router.get("/feature-flags", response_model=list[PanelFeatureFlagResponse])
async def list_panel_feature_flags(
    _auth: InternalAuth = Depends(validate_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[PanelFeatureFlagResponse]:
    _require_panel_admin(_auth)
    rows = list(
        (await db.execute(select(FeatureFlag).order_by(FeatureFlag.key.asc()))).scalars().all()
    )
    return [PanelFeatureFlagResponse.model_validate(r) for r in rows]


@router.patch("/feature-flags/{key}", response_model=PanelFeatureFlagResponse)
async def patch_panel_feature_flag(
    key: str,
    payload: PanelFeatureFlagPatch,
    _auth: InternalAuth = Depends(validate_api_key),
    db: AsyncSession = Depends(get_db),
) -> PanelFeatureFlagResponse:
    _require_panel_admin(_auth)

    row = await db.get(FeatureFlag, key)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Feature flag '{key}' no encontrado")

    prev_enabled = row.enabled
    row.enabled = payload.enabled
    row.updated_by = payload.updated_by
    row.updated_at = datetime.utcnow()

    await _write_audit_log(
        db,
        actor_id="panel-admin-service",
        actor_email=payload.updated_by,
        actor_role="SUPER_ADMIN",
        action="FLAG_TOGGLE",
        resource_type="feature_flag",
        resource_id=key,
        metadata={"prev_enabled": prev_enabled, "new_enabled": payload.enabled},
    )

    await db.commit()
    await db.refresh(row)
    return PanelFeatureFlagResponse.model_validate(row)
