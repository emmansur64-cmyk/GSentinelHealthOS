from __future__ import annotations

import hmac
import hashlib

import pytest

from whatsapp_gateway.app import main as gateway_main
from whatsapp_gateway.services.whatsapp_service import WhatsAppService


def _service(secret: str = "app-secret") -> WhatsAppService:
    return WhatsAppService(
        phone_number_id="1093032243892458",
        business_account_id="967835399226590",
        access_token="token",
        app_secret=secret,
        verify_token="verify",
    )


def test_valid_meta_signature_accepts_raw_body() -> None:
    body = b'{"entry":[{"changes":[]}]}'
    secret = "app-secret"
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    assert _service(secret).verify_signature(body, f"sha256={digest}") is True


def test_invalid_meta_signature_rejects() -> None:
    body = b'{"entry":[{"changes":[]}]}'

    assert _service("app-secret").verify_signature(body, "sha256=bad") is False


@pytest.mark.asyncio
async def test_empty_app_secret_fails_production_startup(monkeypatch) -> None:
    monkeypatch.setattr(gateway_main, "REDIS_URL", "redis://sentinel-redis-master:6379")
    monkeypatch.setattr(gateway_main, "WHATSAPP_ACCESS_TOKEN", "token")
    monkeypatch.setattr(gateway_main, "WHATSAPP_APP_SECRET", "")
    monkeypatch.setattr(gateway_main, "WHATSAPP_PHONE_NUMBER_ID", "1093032243892458")
    monkeypatch.setattr(gateway_main, "WHATSAPP_BUSINESS_ACCOUNT_ID", "967835399226590")

    with pytest.raises(RuntimeError, match="Gateway preflight fallo"):
        await gateway_main._gateway_preflight()
