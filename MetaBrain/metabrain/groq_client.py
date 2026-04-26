"""Production-grade Groq client with secure config, timeout, metrics, and cache."""

from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from time import perf_counter
from typing import Any

from metabrain.cache import GLOBAL_CACHE, InMemoryTTLCache, build_cache_key
from metabrain.config import NLGSettings, get_settings, reload_settings
from metabrain.logger import get_logger
from metabrain.metrics import GLOBAL_METRICS, RuntimeMetrics

try:
    from groq import APIConnectionError, APIStatusError, APITimeoutError, Groq
except Exception:  # pragma: no cover - optional dependency at import time
    Groq = None

    class _GroqUnavailableError(Exception):
        """Fallback exception used when Groq SDK is unavailable."""

    APIConnectionError = _GroqUnavailableError
    APIStatusError = _GroqUnavailableError
    APITimeoutError = _GroqUnavailableError


logger = get_logger(__name__)


class GroqClientError(RuntimeError):
    """Base exception for Groq client runtime failures."""


@dataclass(frozen=True)
class PromptResponse:
    """Structured response for one Groq invocation."""

    text: str
    model: str
    latency_ms: float
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    from_cache: bool = False


class GroqClient:
    """Thin Groq SDK wrapper with retries delegated to caller and safe observability."""

    def __init__(
        self,
        *,
        settings: NLGSettings | None = None,
        metrics: RuntimeMetrics | None = None,
        cache: InMemoryTTLCache | None = None,
        dynamic_config: bool = True,
    ) -> None:
        self._settings = settings or get_settings()
        self._metrics = metrics or GLOBAL_METRICS
        self._cache = cache or GLOBAL_CACHE
        self._dynamic_config = dynamic_config
        self._client_lock = Lock()
        self._client = None
        self._api_key_in_use = self._settings.groq_api_key

    def _active_settings(self) -> NLGSettings:
        if self._dynamic_config:
            settings = reload_settings()
            self._settings = settings
            return settings
        return self._settings

    def _ensure_client(self, settings: NLGSettings):
        if not settings.nlg_groq_enabled:
            raise GroqClientError("Groq deshabilitado por NLG_GROQ_ENABLED=false.")
        if not settings.groq_api_key:
            raise GroqClientError("GROQ_API_KEY no configurada.")
        if Groq is None:
            raise GroqClientError("SDK `groq` no disponible en el entorno actual.")

        with self._client_lock:
            if self._client is None or self._api_key_in_use != settings.groq_api_key:
                self._client = Groq(api_key=settings.groq_api_key)
                self._api_key_in_use = settings.groq_api_key
        return self._client

    def run_prompt(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout_seconds: float | None = None,
        use_cache: bool = True,
    ) -> PromptResponse:
        """Run a Groq completion and return structured metadata."""
        settings = self._active_settings()
        effective_model = model or settings.nlg_groq_model
        effective_temperature = temperature if temperature is not None else settings.nlg_groq_temperature
        effective_max_tokens = max_tokens if max_tokens is not None else settings.nlg_groq_max_tokens
        effective_timeout = timeout_seconds if timeout_seconds is not None else settings.nlg_groq_timeout_seconds

        self._metrics.record_request()
        cache_key = build_cache_key(
            "groq",
            effective_model,
            f"{effective_temperature:.3f}",
            str(effective_max_tokens),
            system_prompt,
            user_prompt,
        )

        if use_cache:
            cached = self._cache.get(cache_key)
            if cached is not None and isinstance(cached, PromptResponse):
                self._metrics.record_cache_hit()
                return PromptResponse(
                    text=cached.text,
                    model=cached.model,
                    latency_ms=cached.latency_ms,
                    prompt_tokens=cached.prompt_tokens,
                    completion_tokens=cached.completion_tokens,
                    total_tokens=cached.total_tokens,
                    from_cache=True,
                )
            self._metrics.record_cache_miss()

        client = self._ensure_client(settings)
        started = perf_counter()
        try:
            messages: list[dict[str, str]] = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            request_client = client.with_options(timeout=effective_timeout) if hasattr(client, "with_options") else client
            response = request_client.chat.completions.create(
                model=effective_model,
                messages=messages,
                temperature=effective_temperature,
                max_tokens=effective_max_tokens,
            )

            content = _extract_text(response)
            prompt_tokens, completion_tokens, total_tokens = _extract_usage(response)
            elapsed_ms = round((perf_counter() - started) * 1000.0, 2)

            prompt_response = PromptResponse(
                text=content,
                model=effective_model,
                latency_ms=elapsed_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                from_cache=False,
            )
            self._metrics.record_groq_call(
                latency_ms=elapsed_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
            )
            if use_cache:
                self._cache.set(cache_key, prompt_response)

            logger.info(
                "groq_call_ok",
                extra={
                    "model": effective_model,
                    "latency_ms": elapsed_ms,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                },
            )
            return prompt_response

        except APITimeoutError as exc:
            elapsed_ms = round((perf_counter() - started) * 1000.0, 2)
            self._metrics.record_timeout()
            self._metrics.record_error()
            logger.error(
                "groq_timeout",
                extra={
                    "model": effective_model,
                    "latency_ms": elapsed_ms,
                    "timeout_seconds": effective_timeout,
                    "error": str(exc),
                },
            )
            raise GroqClientError(f"Timeout al invocar Groq (>{effective_timeout}s).") from exc

        except APIConnectionError as exc:
            self._metrics.record_error()
            logger.error(
                "groq_connection_error",
                extra={"model": effective_model, "error": str(exc)},
            )
            raise GroqClientError(f"Error de conexion con Groq: {exc}") from exc

        except APIStatusError as exc:
            self._metrics.record_error()
            status = getattr(exc, "status_code", "unknown")
            message = getattr(exc, "message", str(exc))
            logger.error(
                "groq_api_status_error",
                extra={"model": effective_model, "status_code": status, "error": message},
            )
            raise GroqClientError(f"Groq devolvio error HTTP {status}: {message}") from exc

        except Exception as exc:  # pragma: no cover - runtime networking and SDK internals
            self._metrics.record_error()
            logger.error(
                "groq_unknown_error",
                extra={"model": effective_model, "error": str(exc)},
            )
            raise GroqClientError(f"Error inesperado al invocar Groq: {exc}") from exc


def _extract_text(response: Any) -> str:
    choices = getattr(response, "choices", None) or []
    if not choices:
        raise GroqClientError("Respuesta vacia de Groq: no hay choices.")

    message = getattr(choices[0], "message", None)
    content = getattr(message, "content", "") if message is not None else ""
    text = (content or "").strip()
    if not text:
        raise GroqClientError("Respuesta vacia de Groq: content vacio.")
    return text


def _extract_usage(response: Any) -> tuple[int, int, int]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return 0, 0, 0

    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(usage, "total_tokens", 0) or 0)
    if total_tokens <= 0:
        total_tokens = prompt_tokens + completion_tokens
    return prompt_tokens, completion_tokens, total_tokens


_DEFAULT_CLIENT: GroqClient | None = None
_DEFAULT_CLIENT_LOCK = Lock()


def get_default_client() -> GroqClient:
    global _DEFAULT_CLIENT
    with _DEFAULT_CLIENT_LOCK:
        if _DEFAULT_CLIENT is None:
            _DEFAULT_CLIENT = GroqClient()
    return _DEFAULT_CLIENT


def run_prompt(
    system_prompt: str,
    user_prompt: str,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout_seconds: float | None = None,
) -> str:
    """Compatibility wrapper that returns only the response text."""
    response = get_default_client().run_prompt(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout_seconds=timeout_seconds,
    )
    return response.text


def run_prompt_full(
    system_prompt: str,
    user_prompt: str,
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout_seconds: float | None = None,
    use_cache: bool = True,
) -> PromptResponse:
    """Extended API that includes latency and token usage metadata."""
    return get_default_client().run_prompt(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout_seconds=timeout_seconds,
        use_cache=use_cache,
    )


def get_runtime_metrics() -> dict[str, float | int]:
    return GLOBAL_METRICS.snapshot()
