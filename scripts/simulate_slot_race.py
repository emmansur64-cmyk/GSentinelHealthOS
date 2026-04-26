#!/usr/bin/env python3
"""Concurrent slot booking simulator for race-condition validation.

Scenario:
- N concurrent clients try to book the same slot_id against /api/v1/slots/book.
- Captures success/failure/conflict counts and timing.
- Adds automatic retries with exponential backoff for transient errors.

Usage example:
    python scripts/simulate_slot_race.py \
      --base-url http://localhost:8000 \
      --slot-id 42 \
      --concurrency 100 \
      --patient-id-start 1000

Auto-discovery mode (recommended):
        python scripts/simulate_slot_race.py \
            --base-url http://localhost:8000 \
            --doctor-id 1 \
            --date 2026-04-05 \
            --pick-slot first \
            --concurrency 100 \
            --patient-id-start 1000
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import random
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx


SUCCESS_CODES = {200, 201}
CONFLICT_CODES = {409}
TRANSIENT_CODES = {429, 500, 502, 503, 504}


@dataclass
class AttemptResult:
    request_id: int
    status_code: int
    ok: bool
    conflict: bool
    attempts: int
    duration_ms: float
    response_body: dict[str, Any] | str | None
    error: str | None


@dataclass
class SimulationConfig:
    base_url: str
    slot_id: int | None
    doctor_id: int | None
    date: str | None
    pick_slot: str
    concurrency: int
    patient_id_start: int
    timeout_seconds: float
    max_retries: int
    backoff_base_ms: int
    backoff_cap_ms: int
    include_jitter: bool
    warmup_requests: int
    output_json: str | None
    output_csv: str | None


def parse_args() -> SimulationConfig:
    parser = argparse.ArgumentParser(description="Concurrent same-slot booking simulator")
    parser.add_argument("--base-url", required=True, help="API base URL, e.g. http://localhost:8000")
    parser.add_argument(
        "--slot-id",
        type=int,
        default=None,
        help="Slot ID to attack concurrently (optional if using --doctor-id + --date)",
    )
    parser.add_argument(
        "--doctor-id",
        type=int,
        default=None,
        help="Doctor ID for auto-discovery against /api/v1/slots/available",
    )
    parser.add_argument(
        "--date",
        default=None,
        help="Date YYYY-MM-DD for auto-discovery against /api/v1/slots/available",
    )
    parser.add_argument(
        "--pick-slot",
        choices=["first", "random"],
        default="first",
        help="How to choose slot in auto-discovery mode",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=100,
        help="Concurrent booking attempts (50-200 recommended)",
    )
    parser.add_argument(
        "--patient-id-start",
        type=int,
        required=True,
        help="Starting patient ID (must exist in DB); each request uses +i",
    )
    parser.add_argument("--timeout-seconds", type=float, default=10.0, help="HTTP timeout per request")
    parser.add_argument("--max-retries", type=int, default=2, help="Retries for transient failures")
    parser.add_argument("--backoff-base-ms", type=int, default=120, help="Base exponential backoff in ms")
    parser.add_argument("--backoff-cap-ms", type=int, default=2000, help="Backoff cap in ms")
    parser.add_argument(
        "--no-jitter",
        action="store_true",
        help="Disable random jitter in backoff",
    )
    parser.add_argument(
        "--warmup-requests",
        type=int,
        default=0,
        help="Warm-up requests against the same slot before the race (default: 0)",
    )
    parser.add_argument(
        "--output-json",
        default=None,
        help="Optional path to write summary as JSON",
    )
    parser.add_argument(
        "--output-csv",
        default=None,
        help="Optional path to write per-request results as CSV",
    )

    args = parser.parse_args()

    if args.concurrency < 1:
        raise SystemExit("--concurrency must be >= 1")
    if args.max_retries < 0:
        raise SystemExit("--max-retries must be >= 0")
    if args.warmup_requests < 0:
        raise SystemExit("--warmup-requests must be >= 0")
    if args.slot_id is None and (args.doctor_id is None or args.date is None):
        raise SystemExit("Provide --slot-id, or provide both --doctor-id and --date for auto-discovery")

    return SimulationConfig(
        base_url=args.base_url.rstrip("/"),
        slot_id=args.slot_id,
        doctor_id=args.doctor_id,
        date=args.date,
        pick_slot=args.pick_slot,
        concurrency=args.concurrency,
        patient_id_start=args.patient_id_start,
        timeout_seconds=args.timeout_seconds,
        max_retries=args.max_retries,
        backoff_base_ms=args.backoff_base_ms,
        backoff_cap_ms=args.backoff_cap_ms,
        include_jitter=not args.no_jitter,
        warmup_requests=args.warmup_requests,
        output_json=args.output_json,
        output_csv=args.output_csv,
    )


def _compute_backoff_seconds(
    *,
    attempt: int,
    base_ms: int,
    cap_ms: int,
    include_jitter: bool,
) -> float:
    raw_ms = min(cap_ms, base_ms * (2 ** max(0, attempt - 1)))
    if include_jitter:
        raw_ms = raw_ms * random.uniform(0.8, 1.2)
    return raw_ms / 1000.0


def _parse_json_or_text(response: httpx.Response) -> dict[str, Any] | str | None:
    if not response.text:
        return None
    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            return response.json()
        except json.JSONDecodeError:
            return response.text
    return response.text


async def _book_once(
    *,
    client: httpx.AsyncClient,
    request_id: int,
    slot_id: int,
    patient_id: int,
) -> httpx.Response:
    payload = {
        "slot_id": slot_id,
        "patient_id": patient_id,
        "priority": "normal",
        "allow_reassign": False,
    }
    return await client.post("/api/v1/slots/book", json=payload)


async def _resolve_slot_id(config: SimulationConfig, client: httpx.AsyncClient) -> int:
    if config.slot_id is not None:
        return config.slot_id

    assert config.doctor_id is not None
    assert config.date is not None

    response = await client.get(
        "/api/v1/slots/available",
        params={"doctor_id": config.doctor_id, "date": config.date},
    )
    response.raise_for_status()

    body = response.json()
    slots = body.get("slots", []) if isinstance(body, dict) else []
    if not slots:
        raise RuntimeError(
            f"No available slots found for doctor_id={config.doctor_id} date={config.date}"
        )

    if config.pick_slot == "random":
        selected = random.choice(slots)
    else:
        selected = slots[0]

    slot_id = selected.get("id") if isinstance(selected, dict) else None
    if not isinstance(slot_id, int):
        raise RuntimeError("Invalid slot payload from availability endpoint (missing integer id)")

    start_time = selected.get("start_time") if isinstance(selected, dict) else None
    print(
        f"[resolver] selected slot_id={slot_id}"
        + (f" start_time={start_time}" if start_time else "")
    )
    return slot_id


async def _booking_worker(
    *,
    config: SimulationConfig,
    client: httpx.AsyncClient,
    slot_id: int,
    request_id: int,
    patient_id: int,
    start_gate: asyncio.Event,
) -> AttemptResult:
    await start_gate.wait()

    started = time.perf_counter()
    attempt = 0
    last_error: str | None = None

    while True:
        attempt += 1
        try:
            response = await _book_once(
                client=client,
                request_id=request_id,
                slot_id=slot_id,
                patient_id=patient_id,
            )

            body = _parse_json_or_text(response)
            status = response.status_code
            duration_ms = (time.perf_counter() - started) * 1000

            if status in SUCCESS_CODES:
                return AttemptResult(
                    request_id=request_id,
                    status_code=status,
                    ok=True,
                    conflict=False,
                    attempts=attempt,
                    duration_ms=duration_ms,
                    response_body=body,
                    error=None,
                )

            if status in CONFLICT_CODES:
                return AttemptResult(
                    request_id=request_id,
                    status_code=status,
                    ok=False,
                    conflict=True,
                    attempts=attempt,
                    duration_ms=duration_ms,
                    response_body=body,
                    error=None,
                )

            if status in TRANSIENT_CODES and attempt <= config.max_retries + 1:
                await asyncio.sleep(
                    _compute_backoff_seconds(
                        attempt=attempt,
                        base_ms=config.backoff_base_ms,
                        cap_ms=config.backoff_cap_ms,
                        include_jitter=config.include_jitter,
                    )
                )
                continue

            return AttemptResult(
                request_id=request_id,
                status_code=status,
                ok=False,
                conflict=False,
                attempts=attempt,
                duration_ms=duration_ms,
                response_body=body,
                error=f"HTTP_{status}",
            )

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            if attempt <= config.max_retries + 1:
                await asyncio.sleep(
                    _compute_backoff_seconds(
                        attempt=attempt,
                        base_ms=config.backoff_base_ms,
                        cap_ms=config.backoff_cap_ms,
                        include_jitter=config.include_jitter,
                    )
                )
                continue

            duration_ms = (time.perf_counter() - started) * 1000
            return AttemptResult(
                request_id=request_id,
                status_code=0,
                ok=False,
                conflict=False,
                attempts=attempt,
                duration_ms=duration_ms,
                response_body=None,
                error=last_error,
            )


def _percentile(sorted_values: list[float], p: float) -> float:
    if not sorted_values:
        return 0.0
    index = int((p / 100) * (len(sorted_values) - 1))
    return sorted_values[index]


def summarize(results: list[AttemptResult], total_seconds: float) -> dict[str, Any]:
    successes = [r for r in results if r.ok]
    conflicts = [r for r in results if r.conflict]
    failures = [r for r in results if (not r.ok and not r.conflict)]

    latencies = sorted(r.duration_ms for r in results)
    attempts_used = [r.attempts for r in results]

    status_count: dict[int, int] = {}
    for r in results:
        status_count[r.status_code] = status_count.get(r.status_code, 0) + 1

    success_appointment_ids = []
    for r in successes:
        body = r.response_body
        if isinstance(body, dict):
            appt_id = body.get("appointment_id")
            if appt_id is not None:
                success_appointment_ids.append(appt_id)

    unique_success_appointment_ids = set(success_appointment_ids)

    duplicate_booking_detected = len(successes) > 1
    conflict_rejection_ok = len(successes) <= 1 and (len(conflicts) + len(failures)) == max(0, len(results) - 1)

    summary = {
        "total_requests": len(results),
        "success_count": len(successes),
        "conflict_count": len(conflicts),
        "failure_count": len(failures),
        "execution_seconds": round(total_seconds, 4),
        "rps": round(len(results) / total_seconds, 2) if total_seconds > 0 else 0.0,
        "latency_ms": {
            "min": round(min(latencies), 2) if latencies else 0.0,
            "avg": round(sum(latencies) / len(latencies), 2) if latencies else 0.0,
            "p95": round(_percentile(latencies, 95), 2),
            "max": round(max(latencies), 2) if latencies else 0.0,
        },
        "attempts": {
            "avg_retries_used": round((sum(attempts_used) / len(attempts_used)) - 1, 3)
            if attempts_used
            else 0.0,
            "max_attempts": max(attempts_used) if attempts_used else 0,
        },
        "status_distribution": status_count,
        "validation": {
            "duplicate_booking_detected": duplicate_booking_detected,
            "conflict_rejection_ok": conflict_rejection_ok,
            "successful_appointment_ids": list(unique_success_appointment_ids),
        },
        "sample_failures": [
            {
                "request_id": f.request_id,
                "status_code": f.status_code,
                "error": f.error,
                "response": f.response_body,
            }
            for f in failures[:5]
        ],
    }
    return summary


def _results_to_rows(results: list[AttemptResult]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for r in results:
        row = {
            "request_id": r.request_id,
            "status_code": r.status_code,
            "ok": r.ok,
            "conflict": r.conflict,
            "attempts": r.attempts,
            "duration_ms": round(r.duration_ms, 3),
            "error": r.error,
        }
        rows.append(row)
    return rows


def _write_json(path_str: str, payload: dict[str, Any]) -> None:
    path = Path(path_str)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)


def _write_csv(path_str: str, rows: list[dict[str, Any]]) -> None:
    path = Path(path_str)
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["request_id", "status_code", "ok", "conflict", "attempts", "duration_ms", "error"]
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


async def _run_warmup(config: SimulationConfig, client: httpx.AsyncClient, slot_id: int) -> None:
    if config.warmup_requests <= 0:
        return

    print(f"[warmup] running {config.warmup_requests} warm-up requests")
    for i in range(config.warmup_requests):
        patient_id = config.patient_id_start + config.concurrency + i + 100000
        try:
            await _book_once(
                client=client,
                request_id=-(i + 1),
                slot_id=slot_id,
                patient_id=patient_id,
            )
        except (httpx.TimeoutException, httpx.NetworkError):
            # Warm-up should not block main race execution.
            continue


async def run(config: SimulationConfig) -> dict[str, Any]:
    timeout = httpx.Timeout(config.timeout_seconds)
    start_gate = asyncio.Event()

    async with httpx.AsyncClient(base_url=config.base_url, timeout=timeout) as client:
        resolved_slot_id = await _resolve_slot_id(config, client)
        await _run_warmup(config, client, resolved_slot_id)
        tasks: list[asyncio.Task[AttemptResult]] = []

        for i in range(config.concurrency):
            patient_id = config.patient_id_start + i
            tasks.append(
                asyncio.create_task(
                    _booking_worker(
                        config=config,
                        client=client,
                        slot_id=resolved_slot_id,
                        request_id=i + 1,
                        patient_id=patient_id,
                        start_gate=start_gate,
                    )
                )
            )

        started = time.perf_counter()
        start_gate.set()
        results = await asyncio.gather(*tasks)
        elapsed = time.perf_counter() - started

    summary = summarize(results, elapsed)
    summary["target_slot_id"] = resolved_slot_id
    if config.doctor_id is not None:
        summary["target_doctor_id"] = config.doctor_id
    if config.date is not None:
        summary["target_date"] = config.date
    summary["warmup_requests"] = config.warmup_requests
    summary["requests"] = _results_to_rows(results)
    return summary


def print_report(summary: dict[str, Any]) -> None:
    print("\n=== Slot Race Simulation Report ===")
    if "target_slot_id" in summary:
        print(f"Target slot_id:       {summary['target_slot_id']}")
    if "target_doctor_id" in summary and "target_date" in summary:
        print(
            "Target availability:  "
            f"doctor_id={summary['target_doctor_id']} date={summary['target_date']}"
        )
    print(f"Total requests:       {summary['total_requests']}")
    print(f"Success:              {summary['success_count']}")
    print(f"Conflicts (409):      {summary['conflict_count']}")
    print(f"Failures (other):     {summary['failure_count']}")
    print(f"Execution time (s):   {summary['execution_seconds']}")
    print(f"RPS:                  {summary['rps']}")

    lat = summary["latency_ms"]
    print("Latency ms:")
    print(f"  min/avg/p95/max:    {lat['min']} / {lat['avg']} / {lat['p95']} / {lat['max']}")

    att = summary["attempts"]
    print("Retries:")
    print(f"  avg retries used:   {att['avg_retries_used']}")
    print(f"  max attempts:       {att['max_attempts']}")

    print("Status distribution:")
    for code, count in sorted(summary["status_distribution"].items(), key=lambda x: x[0]):
        print(f"  {code}: {count}")

    val = summary["validation"]
    print("Validation:")
    print(f"  duplicate booking detected: {val['duplicate_booking_detected']}")
    print(f"  conflict rejection ok:      {val['conflict_rejection_ok']}")
    print(f"  successful appointment ids: {val['successful_appointment_ids']}")

    if summary["sample_failures"]:
        print("Sample failures:")
        for item in summary["sample_failures"]:
            print(f"  - request_id={item['request_id']} status={item['status_code']} error={item['error']}")


def main() -> int:
    config = parse_args()
    summary = asyncio.run(run(config))
    print_report(summary)

    if config.output_json:
        _write_json(config.output_json, summary)
        print(f"[export] summary json written to {config.output_json}")
    if config.output_csv:
        rows = summary.get("requests", [])
        if isinstance(rows, list):
            _write_csv(config.output_csv, rows)
            print(f"[export] request csv written to {config.output_csv}")

    # Exit non-zero if critical guarantees are violated
    if summary["validation"]["duplicate_booking_detected"]:
        return 2
    if not summary["validation"]["conflict_rejection_ok"]:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
