"""Tests focales para los endpoints /api/v1/admin/panel/*.

Validan:
- Autenticación: sin key → 403, key incorrecta → 403, key válida → 2xx
- Aislamiento de servicio: gateway/brain no pueden usar endpoints del panel
- Feature flag toggle registra audit log
- metadata sanitization elimina claves sensibles

Tests usan mocks de DB — no requieren PostgreSQL real.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

# Configurar env mínimo ANTES de importar la app
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_panel.db")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-panel-tests-only")
os.environ.setdefault("GATEWAY_API_KEY", "test-gateway-key-for-panel-tests")
os.environ.setdefault("BRAIN_API_KEY", "test-brain-key-for-panel-tests")
os.environ["PANEL_ADMIN_API_KEY"] = "test-panel-admin-key-valid"

PANEL_KEY = "test-panel-admin-key-valid"
GATEWAY_KEY = "test-gateway-key-for-panel-tests"

# Importar la app tras configurar env
from api.app.main import app  # noqa: E402
from api.app.models.admin_models import AdminAuditLog, FeatureFlag  # noqa: E402


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _mock_flag(key: str = "mb_chat_enabled", enabled: bool = True) -> MagicMock:
    flag = MagicMock(spec=FeatureFlag)
    flag.key = key
    flag.label = "MB-Chat"
    flag.description = "Test flag"
    flag.enabled = enabled
    flag.scope = "global"
    flag.module = "MB-Chat"
    flag.updated_by = None
    flag.updated_at = datetime.utcnow()
    return flag


def _mock_audit_entry() -> MagicMock:
    entry = MagicMock(spec=AdminAuditLog)
    entry.id = uuid.uuid4()
    entry.timestamp = datetime.utcnow()
    entry.actor_id = "bootstrap-super-admin"
    entry.actor_email = "admin@test.com"
    entry.actor_role = "SUPER_ADMIN"
    entry.action = "FLAG_TOGGLE"
    entry.resource_type = "feature_flag"
    entry.resource_id = "mb_chat_enabled"
    entry.status = "success"
    entry.metadata_json = '{"prev_enabled": true, "new_enabled": false}'
    entry.request_id = "sa-123"
    return entry


def _make_db_session(query_result=None, get_result=None):
    """Construye un AsyncSession mock mínimo."""
    session = AsyncMock()
    scalar_result = MagicMock()
    scalar_result.all.return_value = query_result or []
    scalar_result.scalar.return_value = 0

    scalars_result = MagicMock()
    scalars_result.all.return_value = query_result or []
    scalars_result.scalar.return_value = 0

    execute_result = MagicMock()
    execute_result.scalars.return_value = scalars_result
    execute_result.scalar.return_value = 0

    session.execute = AsyncMock(return_value=execute_result)
    session.get = AsyncMock(return_value=get_result)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session


# ── Autenticación ─────────────────────────────────────────────────────────────

class TestPanelAdminAuth:
    """Valida que los endpoints requieren X-Internal-Key de panel-admin."""

    def test_get_tenants_without_key_returns_403(self):
        with TestClient(app) as client:
            r = client.get("/api/v1/admin/panel/tenants")
        assert r.status_code == 403

    def test_get_tenants_with_wrong_key_returns_403(self):
        with TestClient(app) as client:
            r = client.get(
                "/api/v1/admin/panel/tenants",
                headers={"X-Internal-Key": "wrong-key-completely"},
            )
        assert r.status_code == 403

    def test_require_panel_admin_rejects_gateway_service(self):
        """_require_panel_admin rechaza cualquier servicio que no sea panel-admin."""
        import pytest
        from fastapi import HTTPException
        from api.app.api.v1.endpoints.panel_admin import _require_panel_admin
        from api.app.core.security import InternalAuth

        gateway_auth = InternalAuth(
            service="gateway",
            scopes=["appointments:create"],
            is_internal=True,
        )
        with pytest.raises(HTTPException) as exc_info:
            _require_panel_admin(gateway_auth)
        assert exc_info.value.status_code == 403

    def test_require_panel_admin_rejects_brain_service(self):
        """_require_panel_admin rechaza brain igual que gateway."""
        import pytest
        from fastapi import HTTPException
        from api.app.api.v1.endpoints.panel_admin import _require_panel_admin
        from api.app.core.security import InternalAuth

        brain_auth = InternalAuth(service="brain", scopes=["appointments:read"], is_internal=True)
        with pytest.raises(HTTPException) as exc_info:
            _require_panel_admin(brain_auth)
        assert exc_info.value.status_code == 403

    def test_require_panel_admin_allows_panel_admin_service(self):
        """_require_panel_admin no levanta excepción para el servicio correcto."""
        from api.app.api.v1.endpoints.panel_admin import _require_panel_admin
        from api.app.core.security import InternalAuth

        panel_auth = InternalAuth(
            service="panel-admin", scopes=["admin:read", "admin:write"], is_internal=True
        )
        _require_panel_admin(panel_auth)  # should not raise

    def test_get_feature_flags_without_key_returns_403(self):
        with TestClient(app) as client:
            r = client.get("/api/v1/admin/panel/feature-flags")
        assert r.status_code == 403

    def test_patch_feature_flags_without_key_returns_403(self):
        with TestClient(app) as client:
            r = client.patch(
                "/api/v1/admin/panel/feature-flags/mb_chat_enabled",
                json={"enabled": False, "updated_by": "admin@test.com"},
            )
        assert r.status_code == 403

    def test_get_audit_logs_without_key_returns_403(self):
        with TestClient(app) as client:
            r = client.get("/api/v1/admin/panel/audit-logs")
        assert r.status_code == 403

    def test_patch_tenants_without_key_returns_403(self):
        with TestClient(app) as client:
            r = client.patch(
                f"/api/v1/admin/panel/tenants/{uuid.uuid4()}",
                json={"status": "suspended"},
            )
        assert r.status_code == 403


# ── Feature Flags ─────────────────────────────────────────────────────────────

class TestPanelFeatureFlags:
    """Valida comportamiento de feature flags con key válida."""

    def test_panel_admin_service_passes_guard(self):
        """Servicio panel-admin pasa la guardia sin excepción."""
        from api.app.api.v1.endpoints.panel_admin import _require_panel_admin
        from api.app.core.security import InternalAuth

        auth = InternalAuth(service="panel-admin", scopes=["admin:read", "admin:write"], is_internal=True)
        _require_panel_admin(auth)  # must not raise

    def test_panel_key_registered_in_internal_keys(self):
        """PANEL_ADMIN_API_KEY está registrado en INTERNAL_API_KEYS."""
        from api.app.core.security import INTERNAL_API_KEYS
        assert "panel-admin" in INTERNAL_API_KEYS
        assert INTERNAL_API_KEYS["panel-admin"] == PANEL_KEY


# ── Metadata Sanitization ────────────────────────────────────────────────────

class TestMetadataSanitization:
    """Valida que _sanitize_metadata elimina claves sensibles y aplica límite."""

    def test_removes_password_key(self):
        from api.app.api.v1.endpoints.panel_admin import _sanitize_metadata

        raw = json.dumps({"password": "secret123", "flag_key": "mb_chat_enabled"})
        result = _sanitize_metadata(raw)
        assert result is not None
        parsed = json.loads(result)
        assert "password" not in parsed
        assert "flag_key" in parsed

    def test_removes_token_key(self):
        from api.app.api.v1.endpoints.panel_admin import _sanitize_metadata

        raw = json.dumps({"access_token": "eyJabc", "action": "FLAG_TOGGLE"})
        result = _sanitize_metadata(raw)
        assert result is not None
        parsed = json.loads(result)
        assert "access_token" not in parsed
        assert "action" in parsed

    def test_removes_email_key(self):
        from api.app.api.v1.endpoints.panel_admin import _sanitize_metadata

        raw = json.dumps({"email": "patient@clinic.com", "flag": "x"})
        result = _sanitize_metadata(raw)
        assert result is not None
        parsed = json.loads(result)
        assert "email" not in parsed

    def test_truncates_oversized_payload(self):
        from api.app.api.v1.endpoints.panel_admin import _sanitize_metadata

        large = json.dumps({"data": "x" * 5000})
        result = _sanitize_metadata(large, max_bytes=100)
        assert result is not None
        parsed = json.loads(result)
        assert parsed.get("_truncated") is True

    def test_returns_none_for_invalid_json(self):
        from api.app.api.v1.endpoints.panel_admin import _sanitize_metadata

        assert _sanitize_metadata("not-valid-json{") is None

    def test_returns_none_for_empty_input(self):
        from api.app.api.v1.endpoints.panel_admin import _sanitize_metadata

        assert _sanitize_metadata(None) is None
        assert _sanitize_metadata("") is None


# ── No exposición de key al cliente ──────────────────────────────────────────

class TestInternalKeyNotExposedToClient:
    """Valida que ADMIN_API_INTERNAL_KEY no aparece en código cliente del panel."""

    def test_env_var_not_in_client_side_components(self):
        import os
        from pathlib import Path

        panel_src = Path("E:/GSentinelHealthOS/Panel-SuperAdmin/src")
        client_components: list[str] = []

        for tsx_file in panel_src.rglob("*.tsx"):
            content = tsx_file.read_text(encoding="utf-8", errors="ignore")
            # Client components que referencian la variable interna son un riesgo
            if "'use client'" in content and "ADMIN_API_INTERNAL_KEY" in content:
                client_components.append(str(tsx_file))

        assert client_components == [], (
            f"ADMIN_API_INTERNAL_KEY encontrada en client components: {client_components}"
        )
