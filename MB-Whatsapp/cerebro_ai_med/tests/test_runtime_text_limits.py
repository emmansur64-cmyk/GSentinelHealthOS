from __future__ import annotations

from cerebro_ai_med.api.runtime import load_runtime_settings
from cerebro_ai_med.api.validators import sanitize_text_input


def test_runtime_max_text_chars_can_be_unlimited(monkeypatch) -> None:
    monkeypatch.setenv("CEREBRO_MAX_TEXT_CHARS", "0")
    settings = load_runtime_settings()
    assert settings.max_text_chars is None


def test_sanitize_text_allows_large_payload_when_unlimited(monkeypatch) -> None:
    monkeypatch.setenv("CEREBRO_MAX_TEXT_CHARS", "0")
    long_text = "dolor " * 30000
    sanitized = sanitize_text_input(long_text)
    assert len(sanitized) > 12000
