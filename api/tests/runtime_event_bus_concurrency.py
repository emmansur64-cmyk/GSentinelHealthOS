"""Local concurrency validation for bounded in-memory runtime event bus.

This script is local-only and uses synthetic events. It does not call external
providers or networks.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from pathlib import Path
import random
import sys
import time
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from MetaBrain.observability_py.event_bus import InMemoryObservabilityEventBus
from MetaBrain.observability_py.types import ObservabilityEvent

MAX_EVENTS = 100
SCENARIOS = [
    {"workers": 10, "events_per_worker": 100, "readers": 0},
    {"workers": 50, "events_per_worker": 100, "readers": 0},
    {"workers": 50, "events_per_worker": 100, "readers": 8},
]


def _build_event(worker: int, index: int) -> ObservabilityEvent:
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    trace_id = f"trace-w{worker}-e{index}"
    correlation_id = f"corr-w{worker}-e{index}"
    return ObservabilityEvent(
        event_id=f"evt-w{worker}-e{index}",
        trace_id=trace_id,
        correlation_id=correlation_id,
        layer="system",
        event_type="runtime_concurrency_test",
        severity="info",
        payload_summary={
            "worker": worker,
            "index": index,
            "synthetic": True,
        },
        safety_flags=["external_export_disabled", "phi_blocked"],
        created_at=now,
    )


def _publisher(bus: InMemoryObservabilityEventBus, worker: int, events_per_worker: int) -> int:
    published = 0
    for index in range(events_per_worker):
        bus.publish(_build_event(worker, index))
        published += 1
        if index % 10 == 0:
            # Small jitter to increase interleaving without long sleeps.
            time.sleep(random.uniform(0.0, 0.0004))
    return published


def _reader(bus: InMemoryObservabilityEventBus, iterations: int) -> int:
    reads = 0
    for _ in range(iterations):
        events = bus.list()
        # Verify list() remains safe while writes occur.
        for event in events[-5:]:
            if not event.trace_id or not event.correlation_id:
                raise RuntimeError("event missing trace_id/correlation_id during concurrent read")
        reads += 1
        time.sleep(random.uniform(0.0, 0.0003))
    return reads


def _run_scenario(workers: int, events_per_worker: int, readers: int, max_events: int) -> dict[str, Any]:
    bus = InMemoryObservabilityEventBus(max_events=max_events)
    futures = []
    errors: list[str] = []
    total_published = 0

    with ThreadPoolExecutor(max_workers=workers + readers + 2) as executor:
        for worker in range(workers):
            futures.append(executor.submit(_publisher, bus, worker, events_per_worker))
        for _ in range(readers):
            futures.append(executor.submit(_reader, bus, 700))

        for future in as_completed(futures):
            try:
                result = future.result()
                if isinstance(result, int):
                    # Reader and publisher both return int; only publishers are counted by index.
                    pass
            except Exception as exc:  # pragma: no cover - explicit scenario diagnostics
                errors.append(str(exc))

    total_published = workers * events_per_worker
    retained = len(bus.list())
    stats = bus.stats()
    diagnostics = bus.diagnostics() if hasattr(bus, "diagnostics") else {}
    dropped = int(stats.get("dropped_events", 0))
    expired = int(diagnostics.get("expired_events", 0)) if isinstance(diagnostics, dict) else 0
    expected_retained = min(max_events, total_published)
    expected_dropped = max(0, total_published - max_events)
    total_seen = retained + dropped + expired

    # Structural validation on retained payload.
    corruption = 0
    for event in bus.list():
        try:
            payload = asdict(event)
            if not payload.get("trace_id") or not payload.get("correlation_id"):
                corruption += 1
        except Exception:
            corruption += 1

    return {
        "workers": workers,
        "events_per_worker": events_per_worker,
        "readers": readers,
        "max_events": max_events,
        "total_published": total_published,
        "retained": retained,
        "dropped_events": dropped,
        "expected_retained": expected_retained,
        "expected_dropped": expected_dropped,
        "expired_events": expired,
        "total_seen": total_seen,
        "bounded": retained <= max_events and stats.get("current_size", 0) <= stats.get("max_size", max_events),
        "count_consistent": retained == expected_retained and dropped == expected_dropped and total_seen == total_published,
        "trace_fields_ok": corruption == 0,
        "errors": errors,
    }


def main() -> int:
    results: list[dict[str, Any]] = []
    for scenario in SCENARIOS:
        results.append(
            _run_scenario(
                workers=int(scenario["workers"]),
                events_per_worker=int(scenario["events_per_worker"]),
                readers=int(scenario["readers"]),
                max_events=MAX_EVENTS,
            )
        )

    ok = True
    for result in results:
        print(result)
        if result["errors"]:
            ok = False
        if not result["bounded"]:
            ok = False
        if not result["count_consistent"]:
            ok = False
        if not result["trace_fields_ok"]:
            ok = False

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
