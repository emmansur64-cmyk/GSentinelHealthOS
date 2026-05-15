"""Local latency baseline for passive runtime integration.

Run only in a lab environment with FastAPI/TestClient installed.
"""

from __future__ import annotations

import importlib
import os
from pathlib import Path
import statistics
import sys
import time

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


REQUESTS = int(os.getenv("RUNTIME_LATENCY_REQUESTS", "200"))
ENDPOINT = os.getenv("RUNTIME_LATENCY_ENDPOINT", "/")


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, round((percentile / 100) * (len(ordered) - 1)))
    return ordered[index]


def _configure_flags(enabled: bool) -> None:
    os.environ["AI_RUNTIME_ENABLED"] = "false"
    os.environ["AI_RUNTIME_SHADOW_MODE"] = "true"
    os.environ["AI_RUNTIME_DRY_RUN"] = "true"
    os.environ["AI_RUNTIME_KILL_SWITCH"] = "true"
    os.environ["AI_RUNTIME_SAFE_FALLBACK"] = "true"
    os.environ["AI_RUNTIME_BLOCKING_ENABLED"] = "false"
    os.environ["OBSERVABILITY_ENABLED"] = "true" if enabled else "false"
    os.environ["OBSERVABILITY_SHADOW_MODE"] = "true"
    os.environ["OBSERVABILITY_EXTERNAL_EXPORT_ENABLED"] = "false"
    os.environ["OBSERVABILITY_PHI_ALLOWED"] = "false"
    os.environ["DEBUG"] = "false"
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./runtime_lab.sqlite"
    os.environ["REDIS_URL"] = "redis://127.0.0.1:6379"


def _run_case(enabled: bool) -> dict[str, float | int | str]:
    _configure_flags(enabled)
    from fastapi.testclient import TestClient

    module = importlib.import_module("api.app.main")
    app = module.app
    module.initialize_runtime_integration_state(app)

    latencies: list[float] = []
    client = TestClient(app)
    for _ in range(REQUESTS):
        started = time.perf_counter()
        response = client.get(ENDPOINT)
        elapsed = (time.perf_counter() - started) * 1000
        if response.status_code >= 500:
            raise RuntimeError(f"unexpected status {response.status_code}: {response.text[:200]}")
        latencies.append(elapsed)

    return {
        "enabled": str(enabled),
        "requests": REQUESTS,
        "endpoint": ENDPOINT,
        "p50_ms": round(statistics.median(latencies), 3),
        "p95_ms": round(_percentile(latencies, 95), 3),
        "p99_ms": round(_percentile(latencies, 99), 3),
    }


def main() -> int:
    try:
        import fastapi  # noqa: F401
        import httpx  # noqa: F401
        import starlette  # noqa: F401
    except ModuleNotFoundError as exc:
        print(f"BLOCKED_FASTAPI_ENV: {exc}")
        return 2

    disabled = _run_case(False)
    enabled = _run_case(True)
    print({"disabled": disabled, "enabled": enabled})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
