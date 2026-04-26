#!/usr/bin/env python3
"""Analyze k6 summary JSON and print bottleneck-focused report.

Usage:
    python scripts/analyze_k6_summary.py artifacts/qa/k6_slot_booking_summary.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def _value(metrics: dict[str, Any], name: str, field: str) -> float | None:
    try:
        raw = metrics[name]["values"][field]
    except KeyError:
        return None
    return float(raw)


def main() -> int:
    if len(sys.argv) != 2:
        print("Uso: python scripts/analyze_k6_summary.py <path_summary_json>")
        return 1

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"No existe archivo: {path}")
        return 1

    data = json.loads(path.read_text(encoding="utf-8"))
    brief = data.get("brief", {})
    raw = data.get("raw", {})
    metrics = raw.get("metrics", {})

    rps = _value(metrics, "http_reqs", "rate")
    p95 = _value(metrics, "http_req_duration", "p(95)")
    p99 = _value(metrics, "http_req_duration", "p(99)")
    err = _value(metrics, "http_req_failed", "rate")

    avail_p95 = _value(metrics, "http_req_duration{endpoint:availability}", "p(95)")
    book_p95 = _value(metrics, "http_req_duration{endpoint:booking}", "p(95)")

    print("\n=== Performance Report (k6) ===")
    print(f"Base URL:             {brief.get('base_url')}")
    print(f"Doctor/date:          {brief.get('doctor_id')} / {brief.get('slot_date')}")
    print(f"Profile/duration:     {brief.get('k6_profile')} / {brief.get('k6_duration')}")
    print(f"RPS:                  {rps}")
    print(f"Latency p95/p99 (ms): {p95} / {p99}")
    print(f"Error rate:           {err}")
    print(f"Avail p95 (ms):       {avail_p95}")
    print(f"Book p95 (ms):        {book_p95}")

    bottlenecks: list[str] = []
    if err is not None and err > 0.08:
        bottlenecks.append("Alta tasa de error: revisar saturacion, limites upstream y pool de conexiones DB")
    if p95 is not None and p95 > 1500:
        bottlenecks.append("Latencia global alta: inspeccionar locking y queries lentas en Postgres")
    if book_p95 is not None and book_p95 > 1200:
        bottlenecks.append("Reserva lenta: revisar transaccion atomica de slot y contencion sobre mismo slot_id")
    if avail_p95 is not None and avail_p95 > 900:
        bottlenecks.append("Disponibilidad lenta: optimizar indices doctor_id+start_time+status")

    print("\nCuellos de botella detectados:")
    if not bottlenecks:
        print("- Ninguno critico segun umbrales configurados")
    else:
        for item in bottlenecks:
            print(f"- {item}")

    print("\nRecomendaciones:")
    print("- Medir lock wait y deadlocks en Postgres durante profile=500/sweep")
    print("- Revisar tamano de pool de DB y timeout de transacciones")
    print("- Considerar cola de reservas o backpressure cuando error_rate crece")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
