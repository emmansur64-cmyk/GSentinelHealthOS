"""Local TTL validation for in-memory runtime event bus.

This script validates optional TTL behavior without external services.
"""

from __future__ import annotations

from pathlib import Path
import sys
import time

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.app.runtime_support.observability.event_bus import InMemoryObservabilityEventBus
from api.app.runtime_support.observability.types import ObservabilityEvent


def _event(name: str) -> ObservabilityEvent:
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return ObservabilityEvent(
        event_id=f"evt-{name}",
        trace_id=f"trace-{name}",
        correlation_id=f"corr-{name}",
        layer="system",
        event_type="runtime_ttl_test",
        severity="info",
        payload_summary={"name": name, "synthetic": True},
        safety_flags=["external_export_disabled", "phi_blocked"],
        created_at=now,
    )


def main() -> int:
    bus = InMemoryObservabilityEventBus(max_events=3, ttl_enabled=True, ttl_seconds=1)

    bus.publish(_event("old-1"))
    bus.publish(_event("old-2"))
    time.sleep(1.2)
    bus.publish(_event("new-1"))

    current = bus.list()
    diagnostics = bus.diagnostics() if hasattr(bus, "diagnostics") else {}

    ok_old_expired = len(current) == 1 and current[0].event_id == "evt-new-1"
    ok_expired_counter = int(diagnostics.get("expired_events", 0)) >= 2

    # Validate maxlen still active while TTL is enabled.
    bus.publish(_event("new-2"))
    bus.publish(_event("new-3"))
    bus.publish(_event("new-4"))

    current_after = bus.list()
    stats = bus.stats()
    diagnostics_after = bus.diagnostics() if hasattr(bus, "diagnostics") else {}

    ok_bounded = len(current_after) == 3 and stats["current_size"] == 3 and stats["max_size"] == 3
    ok_dropped_separate = int(stats.get("dropped_events", 0)) == 1 and int(diagnostics_after.get("expired_events", 0)) >= 2

    result = {
        "retained": len(current_after),
        "max_events": stats["max_size"],
        "dropped_events": int(stats.get("dropped_events", 0)),
        "expired_events": int(diagnostics_after.get("expired_events", 0)),
        "ok_old_expired": ok_old_expired,
        "ok_expired_counter": ok_expired_counter,
        "ok_bounded": ok_bounded,
        "ok_dropped_separate": ok_dropped_separate,
    }
    print(result)

    return 0 if all([ok_old_expired, ok_expired_counter, ok_bounded, ok_dropped_separate]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
