from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class ServiceClientSettings:
    inference_url: str
    decision_url: str
    nlg_url: str
    timeout_seconds: float
    retries: int
    retry_backoff_seconds: float


class ServiceClient:
    def __init__(self, settings: ServiceClientSettings) -> None:
        self._settings = settings
        self._client = httpx.AsyncClient(
            timeout=self._settings.timeout_seconds,
            limits=httpx.Limits(max_connections=1000, max_keepalive_connections=200),
        )

    async def infer(self, model_input: dict[str, Any]) -> dict[str, Any]:
        return await self._post_with_retry(
            url=f"{self._settings.inference_url}/infer",
            payload=model_input,
            service_name="inference-service",
        )

    async def decide(self, model_output: dict[str, Any]) -> dict[str, Any]:
        return await self._post_with_retry(
            url=f"{self._settings.decision_url}/decide",
            payload=model_output,
            service_name="decision-service",
        )

    async def generate(self, decision_output: dict[str, Any], model_output: dict[str, Any], patient_context: dict[str, Any]) -> dict[str, Any]:
        return await self._post_with_retry(
            url=f"{self._settings.nlg_url}/generate",
            payload={
                "decision_output": decision_output,
                "model_output": model_output,
                "patient_context": patient_context,
            },
            service_name="nlg-service",
        )

    async def ping(self, base_url: str) -> bool:
        try:
            response = await self._client.get(f"{base_url}/health/live")
            return response.status_code == 200
        except Exception:
            return False

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _post_with_retry(self, url: str, payload: dict[str, Any], service_name: str) -> dict[str, Any]:
        last_error: Exception | None = None

        for attempt in range(self._settings.retries + 1):
            try:
                response = await self._client.post(url, json=payload)

                if response.status_code >= 500:
                    raise RuntimeError(f"{service_name}_server_error:{response.status_code}")
                if response.status_code >= 400:
                    raise RuntimeError(f"{service_name}_client_error:{response.status_code}:{response.text}")

                data = response.json()
                if not isinstance(data, dict):
                    raise RuntimeError(f"{service_name}_invalid_response")
                return data
            except (httpx.TimeoutException, httpx.RequestError, RuntimeError) as exc:
                last_error = exc
                if attempt < self._settings.retries:
                    await asyncio.sleep(self._settings.retry_backoff_seconds * (attempt + 1))
                    continue
                break

        raise RuntimeError(f"{service_name}_unavailable:{last_error}")
