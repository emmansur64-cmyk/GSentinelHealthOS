"""Local stress validation for bounded passive runtime event bus."""

from __future__ import annotations

import importlib
import os
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


REQUESTS = int(os.getenv("RUNTIME_EVENT_BUS_STRESS_REQUESTS", "1500"))
MAX_EVENTS = int(os.getenv("OBSERVABILITY_EVENT_BUS_MAX_EVENTS", "1000"))
ENDPOINT = os.getenv("RUNTIME_EVENT_BUS_STRESS_ENDPOINT", "/")


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
    os.environ["OBSERVABILITY_EVENT_BUS_MAX_EVENTS"] = str(MAX_EVENTS)
    os.environ["DEBUG"] = "false"
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./runtime_lab.sqlite"
    os.environ["REDIS_URL"] = "redis://127.0.0.1:6379"


def main() -> int:
    try:
        from fastapi.testclient import TestClient
    except ModuleNotFoundError as exc:
        print(f"BLOCKED_FASTAPI_ENV: {exc}")
        return 2

    _configure_flags()
    module = importlib.import_module("api.app.main")
    app = module.app
    module.initialize_runtime_integration_state(app)

    client = TestClient(app)
    for index in range(REQUESTS):
        response = client.get(
            ENDPOINT,
            headers={
                "X-Trace-Id": f"stress-trace-{index}",
                "X-Correlation-Id": f"stress-corr-{index}",
            },
        )
        if response.status_code >= 500:
            raise RuntimeError(f"unexpected status {response.status_code}: {response.text[:200]}")

    stats = app.state.runtime_integration_event_bus.stats()
    expected_dropped = max(0, REQUESTS - stats["max_size"])
    result = {
        "requests": REQUESTS,
        "endpoint": ENDPOINT,
        "current_size": stats["current_size"],
        "max_size": stats["max_size"],
        "dropped_events": stats["dropped_events"],
        "expected_dropped": expected_dropped,
        "bounded": stats["current_size"] <= stats["max_size"],
        "stable": stats["dropped_events"] == expected_dropped,
    }
    print(result)
    return 0 if result["bounded"] and result["stable"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
