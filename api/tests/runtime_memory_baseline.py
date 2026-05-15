"""Local memory baseline for passive runtime integration."""

from __future__ import annotations

import importlib
import os
from pathlib import Path
import sys
import tracemalloc

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


REQUESTS = int(os.getenv("RUNTIME_MEMORY_REQUESTS", "500"))
ENDPOINT = os.getenv("RUNTIME_MEMORY_ENDPOINT", "/")


def _configure_flags() -> None:
    os.environ["AI_RUNTIME_ENABLED"] = "false"
    os.environ["AI_RUNTIME_SHADOW_MODE"] = "true"
    os.environ["AI_RUNTIME_DRY_RUN"] = "true"
    os.environ["AI_RUNTIME_KILL_SWITCH"] = "true"
    os.environ["AI_RUNTIME_SAFE_FALLBACK"] = "true"
    os.environ["AI_RUNTIME_BLOCKING_ENABLED"] = "false"
    os.environ["OBSERVABILITY_ENABLED"] = "true"
    os.environ["OBSERVABILITY_SHADOW_MODE"] = "true"
    os.environ["OBSERVABILITY_EXTERNAL_EXPORT_ENABLED"] = "false"
    os.environ["OBSERVABILITY_PHI_ALLOWED"] = "false"
    os.environ.setdefault("OBSERVABILITY_EVENT_BUS_MAX_EVENTS", "1000")
    os.environ["DEBUG"] = "false"
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./runtime_lab.sqlite"
    os.environ["REDIS_URL"] = "redis://127.0.0.1:6379"


def main() -> int:
    try:
        import fastapi  # noqa: F401
        import httpx  # noqa: F401
        import starlette  # noqa: F401
        from fastapi.testclient import TestClient
    except ModuleNotFoundError as exc:
        print(f"BLOCKED_FASTAPI_ENV: {exc}")
        return 2

    _configure_flags()
    module = importlib.import_module("api.app.main")
    app = module.app
    module.initialize_runtime_integration_state(app)

    tracemalloc.start()
    before = tracemalloc.get_traced_memory()
    client = TestClient(app)
    for _ in range(REQUESTS):
        response = client.get(ENDPOINT)
        if response.status_code >= 500:
            raise RuntimeError(f"unexpected status {response.status_code}: {response.text[:200]}")
    after = tracemalloc.get_traced_memory()

    event_count = len(app.state.runtime_integration_event_bus.list())
    event_bus_stats = app.state.runtime_integration_event_bus.stats()
    print(
        {
            "requests": REQUESTS,
            "endpoint": ENDPOINT,
            "current_before_kb": round(before[0] / 1024, 3),
            "peak_before_kb": round(before[1] / 1024, 3),
            "current_after_kb": round(after[0] / 1024, 3),
            "peak_after_kb": round(after[1] / 1024, 3),
            "event_count": event_count,
            "event_bus": event_bus_stats,
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
