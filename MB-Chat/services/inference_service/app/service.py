from __future__ import annotations

import os
from concurrent.futures import Future, ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from threading import Lock
from time import perf_counter
from typing import Callable

from cerebro_ai_med.models import get_model_service
from cerebro_ai_med.models.schemas import ModelInput as InternalModelInput
from services.shared.contracts import ModelInput, ModelOutput


@dataclass(frozen=True)
class InferenceHealth:
    model_loaded: bool
    model_version: str


class InferenceServiceError(RuntimeError):
    def __init__(self, *, code: str, message: str, category: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.category = category
        self.status_code = status_code


class InferenceEngine:
    def __init__(self, timeout_seconds: float = 0.5, max_workers: int = 4) -> None:
        self._timeout_seconds = max(timeout_seconds, 0.05)
        self._executor = ThreadPoolExecutor(max_workers=max(1, max_workers), thread_name_prefix="inference-worker")
        self._model_service = get_model_service()
        self._load_lock = Lock()
        self._loaded = False

    def health(self) -> InferenceHealth:
        if not self._loaded:
            try:
                self._ensure_model_loaded()
            except Exception:
                return InferenceHealth(model_loaded=False, model_version="unknown")
        return InferenceHealth(model_loaded=True, model_version=self._safe_model_version())

    def predict(self, payload: ModelInput) -> tuple[ModelOutput, float]:
        self._ensure_model_loaded()
        started = perf_counter()

        try:
            internal_input = InternalModelInput.model_validate(payload.model_dump())
        except Exception as exc:
            raise InferenceServiceError(
                code="invalid_input",
                message="Invalid inference input payload.",
                category="validation",
                status_code=422,
            ) from exc

        result = self._run_with_timeout(lambda: self._model_service.predict(internal_input))
        try:
            output = ModelOutput.model_validate(result.model_dump())
        except Exception as exc:
            raise InferenceServiceError(
                code="invalid_model_output",
                message="Model returned an invalid output structure.",
                category="inference",
                status_code=503,
            ) from exc

        elapsed_ms = (perf_counter() - started) * 1000.0
        return output, elapsed_ms

    def _run_with_timeout(self, operation: Callable[[], object]) -> object:
        future: Future[object] = self._executor.submit(operation)
        try:
            return future.result(timeout=self._timeout_seconds)
        except FutureTimeoutError as exc:
            future.cancel()
            raise InferenceServiceError(
                code="inference_timeout",
                message="Inference processing exceeded configured timeout.",
                category="inference",
                status_code=504,
            ) from exc
        except ValueError as exc:
            raise InferenceServiceError(
                code="invalid_input",
                message="Inference request is invalid for the selected source type.",
                category="validation",
                status_code=422,
            ) from exc
        except RuntimeError as exc:
            raise InferenceServiceError(
                code="model_unavailable",
                message="Model is unavailable for inference.",
                category="inference",
                status_code=503,
            ) from exc
        except Exception as exc:
            raise InferenceServiceError(
                code="inference_failed",
                message="Inference could not be completed.",
                category="inference",
                status_code=500,
            ) from exc

    def _ensure_model_loaded(self) -> None:
        if self._loaded:
            return
        with self._load_lock:
            if self._loaded:
                return
            try:
                _ = self._model_service.model_version
                self._loaded = True
            except Exception as exc:
                raise InferenceServiceError(
                    code="model_load_failed",
                    message="Failed to load active model from registry.",
                    category="system",
                    status_code=503,
                ) from exc

    def _safe_model_version(self) -> str:
        try:
            return str(self._model_service.model_version)
        except Exception:
            return "unknown"


_engine_instance: InferenceEngine | None = None
_engine_lock = Lock()


def _read_float_env(name: str, default: float, minimum: float) -> float:
    raw = os.getenv(name, str(default)).strip()
    try:
        return max(float(raw), minimum)
    except Exception:
        return default


def _read_int_env(name: str, default: int, minimum: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        return max(int(raw), minimum)
    except Exception:
        return default


def get_inference_engine() -> InferenceEngine:
    global _engine_instance
    if _engine_instance is not None:
        return _engine_instance

    with _engine_lock:
        if _engine_instance is None:
            timeout_seconds = _read_float_env("INFERENCE_TIMEOUT_SECONDS", 0.5, 0.05)
            max_workers = _read_int_env("INFERENCE_WORKERS", 4, 1)
            _engine_instance = InferenceEngine(timeout_seconds=timeout_seconds, max_workers=max_workers)
    return _engine_instance
