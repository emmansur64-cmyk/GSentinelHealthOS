"""Resolución de cuentas WhatsApp por cliente para gateway multicliente."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from shared.config import DATABASE_URL
from shared.security.secrets import MissingSecretEncryptionKeyError, SecretEncryptionError, decrypt_secret, sha256_hex
from shared.utils import setup_logger

logger = setup_logger(__name__)


_ACCOUNT_SELECT_FIELDS = """
    cwa.client_id AS client_id,
    CASE
        WHEN cwa.clinic_id IS NULL THEN NULL
        WHEN c.id IS NULL THEN NULL
        WHEN COALESCE(c.active, TRUE) = FALSE THEN NULL
        WHEN LOWER(COALESCE(c.status, 'active')) NOT IN ('active', 'connected') THEN NULL
        ELSE cwa.clinic_id
    END AS clinic_id,
    cwa.provider AS provider,
    cwa.phone_number AS phone_number,
    cwa.phone_number_id AS phone_number_id,
    cwa.business_account_id AS business_account_id,
    cwa.meta_business_id AS meta_business_id,
    cwa.waba_id AS waba_id,
    cwa.display_phone_number AS display_phone_number,
    cwa.access_token_encrypted AS access_token_encrypted,
    cwa.app_secret_encrypted AS app_secret_encrypted,
    cwa.verify_token AS verify_token,
    cwa.webhook_enabled AS webhook_enabled,
    cwa.status AS status
"""


@dataclass
class ResolvedWhatsAppAccount:
    client_id: str
    clinic_id: str | None
    provider: str
    phone_number: str | None
    phone_number_id: str
    business_account_id: str | None
    meta_business_id: str | None
    waba_id: str | None
    display_phone_number: str | None
    access_token: str | None
    app_secret: str | None
    verify_token: str | None
    webhook_enabled: bool
    status: str


class ClientWhatsAppAccountResolver:
    """Resuelve credenciales de WhatsApp por client_id o phone_number_id."""

    def __init__(self, database_url: str = DATABASE_URL) -> None:
        self.database_url = self._normalize_database_url(database_url)
        self._engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None

    @staticmethod
    def _normalize_database_url(database_url: str) -> str:
        normalized = (database_url or "").strip()
        if normalized.startswith("postgresql://"):
            return normalized.replace("postgresql://", "postgresql+psycopg://", 1)
        if normalized.startswith("sqlite://") and not normalized.startswith("sqlite+aiosqlite://"):
            return normalized.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return normalized

    def _is_configured(self) -> bool:
        return bool(self.database_url)

    async def _session(self) -> AsyncSession:
        if self._engine is None:
            self._engine = create_async_engine(self.database_url, future=True, pool_pre_ping=True)
            self._session_factory = async_sessionmaker(self._engine, class_=AsyncSession, expire_on_commit=False)
        if self._session_factory is None:
            raise RuntimeError("Session factory no inicializada")
        return self._session_factory()

    async def close(self) -> None:
        if self._engine is not None:
            await self._engine.dispose()
            self._engine = None
            self._session_factory = None

    @staticmethod
    def _decrypt_optional_secret(value: Any, field_name: str) -> str | None:
        if value is None:
            return None
        raw = str(value).strip()
        if not raw:
            return None
        try:
            return decrypt_secret(raw)
        except MissingSecretEncryptionKeyError:
            logger.error("SECRET_ENCRYPTION_KEY faltante; no se pudo descifrar %s", field_name)
            return None
        except SecretEncryptionError as exc:
            logger.error("No se pudo descifrar %s: %s", field_name, exc)
            return None

    @classmethod
    def _row_to_account(cls, row: Any) -> ResolvedWhatsAppAccount:
        return ResolvedWhatsAppAccount(
            client_id=str(row.client_id),
            clinic_id=str(row.clinic_id) if getattr(row, "clinic_id", None) else None,
            provider=str(row.provider or "meta"),
            phone_number=row.phone_number,
            phone_number_id=str(row.phone_number_id),
            business_account_id=row.business_account_id,
            meta_business_id=getattr(row, "meta_business_id", None),
            waba_id=getattr(row, "waba_id", None),
            display_phone_number=getattr(row, "display_phone_number", None),
            access_token=cls._decrypt_optional_secret(row.access_token_encrypted, "access_token_encrypted"),
            app_secret=cls._decrypt_optional_secret(row.app_secret_encrypted, "app_secret_encrypted"),
            verify_token=row.verify_token,
            webhook_enabled=bool(row.webhook_enabled),
            status=str(row.status or "active"),
        )

    async def get_by_phone_number_id(self, phone_number_id: str | None) -> ResolvedWhatsAppAccount | None:
        normalized = (phone_number_id or "").strip()
        if not normalized or not self._is_configured():
            return None

        query = text(
            """
            SELECT
                                """ + _ACCOUNT_SELECT_FIELDS + """
                        FROM client_whatsapp_accounts cwa
                        LEFT JOIN clinics c ON c.id = cwa.clinic_id
                        WHERE cwa.phone_number_id = :phone_number_id
                            AND cwa.status IN ('active', 'connected')
                            AND cwa.webhook_enabled = TRUE
                        ORDER BY cwa.updated_at DESC, cwa.created_at DESC
            LIMIT 1
            """
        )

        try:
            async with await self._session() as session:
                result = await session.execute(query, {"phone_number_id": normalized})
                row = result.first()
        except Exception as exc:
            logger.warning("No se pudo resolver cuenta por phone_number_id=%s: %s", normalized, exc)
            return None

        if row is None:
            return None
        return self._row_to_account(row)

    async def get_by_client_id(self, client_id: str | None) -> ResolvedWhatsAppAccount | None:
        normalized = (client_id or "").strip()
        if not normalized or not self._is_configured():
            return None

        query = text(
            """
            SELECT
                                """ + _ACCOUNT_SELECT_FIELDS + """
                        FROM client_whatsapp_accounts cwa
                        LEFT JOIN clinics c ON c.id = cwa.clinic_id
                        WHERE cwa.client_id = :client_id
                            AND cwa.status IN ('active', 'connected')
                            AND cwa.webhook_enabled = TRUE
                        ORDER BY cwa.updated_at DESC, cwa.created_at DESC
            LIMIT 1
            """
        )

        try:
            async with await self._session() as session:
                result = await session.execute(query, {"client_id": normalized})
                row = result.first()
        except Exception as exc:
            logger.warning("No se pudo resolver cuenta por client_id=%s: %s", normalized, exc)
            return None

        if row is None:
            return None
        return self._row_to_account(row)

    async def get_by_verify_token(self, verify_token: str | None) -> ResolvedWhatsAppAccount | None:
        normalized = (verify_token or "").strip()
        if not normalized or not self._is_configured():
            return None
        verify_token_hash = sha256_hex(normalized)

        query = text(
            """
            SELECT
                                """ + _ACCOUNT_SELECT_FIELDS + """
                        FROM client_whatsapp_accounts cwa
                        LEFT JOIN clinics c ON c.id = cwa.clinic_id
                        WHERE cwa.verify_token = :verify_token
                            AND cwa.status IN ('active', 'connected')
                            AND cwa.webhook_enabled = TRUE
                        ORDER BY cwa.updated_at DESC, cwa.created_at DESC
            LIMIT 1
            """
        )

        try:
            async with await self._session() as session:
                result = await session.execute(query, {"verify_token": verify_token_hash})
                row = result.first()
        except Exception as exc:
            logger.warning("No se pudo resolver cuenta por verify_token: %s", exc)
            return None

        if row is None:
            return None
        return self._row_to_account(row)
