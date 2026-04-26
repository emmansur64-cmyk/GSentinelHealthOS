"""Runner incremental para concurrencia slot-buffer: 5, 10, 20, 30.

Ejecuta el script principal de QA en niveles crecientes de concurrencia,
consolida resultados y emite una tabla comparativa.
Opcionalmente falla por SLA de p95 (corte automatico en CI).

Uso:
  e:/GSentinelHealthOS/.venv/Scripts/python.exe scripts/qa_postgres_slot_buffer_incremental.py --sla-p95-ms 350
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Row:
    requests: int
    book_ok: int
    book_fail: int
    avg_ms: float
    p95_ms: float
    db_errors: int
    deadlocks: int
    exit_code: int


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Incremental PostgreSQL concurrency runner")
    parser.add_argument(
        "--levels",
        nargs="+",
        type=int,
        default=[5, 10, 20, 30],
        help="Concurrency levels to run in order (default: 5 10 20 30)",
    )
    parser.add_argument(
        "--sla-p95-ms",
        type=float,
        default=0.0,
        help="If > 0, fail runner when any level exceeds this p95 SLA",
    )
    parser.add_argument(
        "--out-dir",
        default="artifacts/qa",
        help="Output directory for per-level JSON reports",
    )
    return parser.parse_args()


def _run_level(level: int, out_dir: Path, sla_p95_ms: float) -> Row:
    out_file = out_dir / f"postgres_slot_concurrency_{level}.json"
    cmd = [
        "e:/GSentinelHealthOS/.venv/Scripts/python.exe",
        "scripts/qa_postgres_slot_buffer_concurrency.py",
        "--requests",
        str(level),
        "--fail-on-deadlock",
        "--json-out",
        str(out_file),
    ]
    if sla_p95_ms > 0:
        cmd.extend(["--sla-p95-ms", str(sla_p95_ms)])

    completed = subprocess.run(cmd, cwd="e:/GSentinelHealthOS", check=False)
    payload = json.loads(out_file.read_text(encoding="utf-8"))

    return Row(
        requests=int(payload.get("requests_total", level)),
        book_ok=int(payload.get("book_ok", 0)),
        book_fail=int(payload.get("book_fail", 0)),
        avg_ms=float(payload.get("avg_request_latency_ms", 0.0)),
        p95_ms=float(payload.get("p95_request_latency_ms", 0.0)),
        db_errors=int(payload.get("db_error_count", 0)),
        deadlocks=int(payload.get("deadlock_detected_count", 0)),
        exit_code=int(completed.returncode),
    )


def _print_table(rows: list[Row], sla_p95_ms: float) -> None:
    print("\n=== Comparativa Incremental ===")
    header = (
        "requests | ok | fail | avg_ms | p95_ms | db_errors | deadlocks | exit_code"
    )
    print(header)
    print("-" * len(header))
    for row in rows:
        print(
            f"{row.requests:8d} | {row.book_ok:2d} | {row.book_fail:4d} | "
            f"{row.avg_ms:6.2f} | {row.p95_ms:6.2f} | {row.db_errors:9d} | "
            f"{row.deadlocks:8d} | {row.exit_code:9d}"
        )
    if sla_p95_ms > 0:
        print(f"\nSLA p95 configurada: {sla_p95_ms:.2f} ms")


def main() -> int:
    args = _parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    rows: list[Row] = []
    for level in args.levels:
        print(f"\n>>> Running level {level} ...")
        rows.append(_run_level(level, out_dir, args.sla_p95_ms))

    _print_table(rows, args.sla_p95_ms)

    failed_exit = any(r.exit_code != 0 for r in rows)
    sla_breached = args.sla_p95_ms > 0 and any(r.p95_ms > args.sla_p95_ms for r in rows)

    if failed_exit:
        print("\nRESULT: FAIL (al menos una corrida devolvio exit_code != 0)")
        return 1
    if sla_breached:
        print("\nRESULT: FAIL (SLA p95 excedida en al menos un nivel)")
        return 1

    print("\nRESULT: OK")
    return 0


if __name__ == "__main__":
    os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://sentinel:sentinel_password@localhost:5432/sentinel_health")
    raise SystemExit(main())
