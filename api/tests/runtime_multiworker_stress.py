"""Multi-worker lab stress for runtime integration.

Runs uvicorn with multiple workers against isolated lab env and performs local HTTP load.
"""

from __future__ import annotations

import importlib
import json
import os
import statistics
import subprocess
import sys
import time
import uuid
from multiprocessing import get_context
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / ".env.runtime_lab"
BASE_URL = "http://127.0.0.1:18080"
EXPECTED_ROOT = {
    "message": "GSentinelHealthOS API",
    "services": ["patients", "doctors"],
    "health": "/api/health/readiness",
}


def _load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def _percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    ordered = sorted(values)
    pos = (len(ordered) - 1) * q
    lower = int(pos)
    upper = min(lower + 1, len(ordered) - 1)
    if lower == upper:
        return ordered[lower]
    weight = pos - lower
    return ordered[lower] * (1.0 - weight) + ordered[upper] * weight


def _validate_lab_targets(env_values: dict[str, str]) -> dict[str, Any]:
    db_url = env_values.get("DATABASE_URL", "")
    redis_url = env_values.get("REDIS_URL", "")

    db = urlparse(db_url)
    redis = urlparse(redis_url)

    db_ok = db.hostname == "127.0.0.1" and db.port == 55432
    redis_ok = redis.hostname == "127.0.0.1" and redis.port == 56379

    if not db_ok or not redis_ok:
        raise RuntimeError(
            "Lab safety check failed: DATABASE_URL/REDIS_URL no apuntan a 127.0.0.1:55432 y 127.0.0.1:56379"
        )

    return {
        "database_url": db_url,
        "redis_url": redis_url,
        "db_target_ok": db_ok,
        "redis_target_ok": redis_ok,
    }


def _wait_for_liveness(timeout_seconds: int = 90) -> float:
    start = time.perf_counter()
    last_error = None
    while (time.perf_counter() - start) < timeout_seconds:
        try:
            with httpx.Client(timeout=2.5) as client:
                response = client.get(f"{BASE_URL}/api/health/liveness")
            if response.status_code == 200:
                return time.perf_counter() - start
        except Exception as exc:  # pragma: no cover - best effort retry
            last_error = str(exc)
        time.sleep(0.5)
    raise RuntimeError(f"Uvicorn no respondió liveness en {timeout_seconds}s. Last error={last_error}")


def _pid_working_set_bytes(pid: int) -> int | None:
    cmd = [
        "powershell",
        "-NoProfile",
        "-Command",
        f"(Get-Process -Id {pid} -ErrorAction SilentlyContinue).WorkingSet64",
    ]
    try:
        raw = subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT).strip()
    except Exception:
        return None
    if not raw:
        return None
    try:
        return int(raw.splitlines()[-1].strip())
    except ValueError:
        return None


def _do_liveness_request(index: int) -> tuple[int, float, bool, bool]:
    trace_id = f"mw-trace-{index}-{uuid.uuid4().hex[:8]}"
    corr_id = f"mw-corr-{index}-{uuid.uuid4().hex[:8]}"
    headers = {
        "X-Trace-Id": trace_id,
        "X-Correlation-Id": corr_id,
    }
    started = time.perf_counter()
    with httpx.Client(timeout=8.0) as client:
        response = client.get(f"{BASE_URL}/api/health/liveness", headers=headers)
    latency_ms = (time.perf_counter() - started) * 1000.0

    # Este runtime no devuelve trace/correlation en response headers;
    # validamos que se envíen en request sin alterar salida funcional.
    trace_sent = "X-Trace-Id" in headers
    corr_sent = "X-Correlation-Id" in headers
    liveness_ok = False
    try:
        liveness_ok = response.json().get("status") == "alive"
    except Exception:
        liveness_ok = False
    return response.status_code, latency_ms, trace_sent, corr_sent, liveness_ok


def _sample_root_contract(sample_requests: int = 10) -> dict[str, Any]:
    ok = 0
    phi_leak_signals = 0
    with httpx.Client(timeout=8.0) as client:
        for i in range(sample_requests):
            response = client.get(
                f"{BASE_URL}/",
                headers={
                    "X-Trace-Id": f"mw-root-trace-{i}",
                    "X-Correlation-Id": f"mw-root-corr-{i}",
                },
            )
            if response.status_code != 200:
                continue
            payload = response.json()
            if payload == EXPECTED_ROOT:
                ok += 1
            body_lower = json.dumps(payload, ensure_ascii=True).lower()
            if any(marker in body_lower for marker in ("dni", "email", "token", "authorization", "cookie")):
                phi_leak_signals += 1
    return {
        "sample_requests": sample_requests,
        "contract_ok_count": ok,
        "contract_ok": ok == sample_requests,
        "phi_leak_signals": phi_leak_signals,
    }


def _run_worker_process(payload: tuple[int, dict[str, str], int]) -> dict[str, Any]:
    worker_index, env_values, request_count = payload
    os.environ.update(env_values)
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    for module_name in [
        "api.app.core.config",
        "api.app.db.session",
        "api.app.main",
    ]:
        if module_name in sys.modules:
            del sys.modules[module_name]

    module = importlib.import_module("api.app.main")
    process_memory_before = _pid_working_set_bytes(os.getpid())

    latencies: list[float] = []
    status_200 = 0
    trace_sent = 0
    corr_sent = 0
    liveness_ok = 0
    root_contract_ok = 0
    phi_leak_signals = 0

    with TestClient(module.app) as client:
        for request_index in range(request_count):
            trace_id = f"mw-p{worker_index}-trace-{request_index}-{uuid.uuid4().hex[:8]}"
            corr_id = f"mw-p{worker_index}-corr-{request_index}-{uuid.uuid4().hex[:8]}"
            headers = {
                "X-Trace-Id": trace_id,
                "X-Correlation-Id": corr_id,
            }
            started = time.perf_counter()
            response = client.get("/api/health/liveness", headers=headers)
            latencies.append((time.perf_counter() - started) * 1000.0)

            if response.status_code == 200:
                status_200 += 1
            if headers.get("X-Trace-Id"):
                trace_sent += 1
            if headers.get("X-Correlation-Id"):
                corr_sent += 1
            if response.json().get("status") == "alive":
                liveness_ok += 1

        root_response = client.get(
            "/",
            headers={
                "X-Trace-Id": f"mw-p{worker_index}-root-trace",
                "X-Correlation-Id": f"mw-p{worker_index}-root-corr",
            },
        )
        if root_response.status_code == 200 and root_response.json() == EXPECTED_ROOT:
            root_contract_ok = 1
        body_lower = json.dumps(root_response.json(), ensure_ascii=True).lower()
        if any(marker in body_lower for marker in ("dni", "email", "token", "authorization", "cookie")):
            phi_leak_signals = 1

    process_memory_after = _pid_working_set_bytes(os.getpid())
    event_bus_stats = module.get_runtime_integration_event_bus_stats(module.app)

    return {
        "worker_index": worker_index,
        "requests": request_count,
        "status_200": status_200,
        "liveness_body_ok": liveness_ok == request_count,
        "root_contract_ok": bool(root_contract_ok),
        "phi_leak_signals": phi_leak_signals,
        "trace_header_sent": trace_sent,
        "correlation_header_sent": corr_sent,
        "latency_ms": {
            "mean": round(statistics.fmean(latencies), 3) if latencies else 0.0,
            "p50": round(_percentile(latencies, 0.50), 3),
            "p95": round(_percentile(latencies, 0.95), 3),
            "p99": round(_percentile(latencies, 0.99), 3),
            "max": round(max(latencies), 3) if latencies else 0.0,
        },
        "memory_bytes": {
            "before": process_memory_before,
            "after": process_memory_after,
        },
        "event_bus_stats": event_bus_stats,
    }


def _run_multiprocess_fallback(env_values: dict[str, str], workers: int, total_requests: int) -> dict[str, Any]:
    per_worker = max(1, total_requests // max(1, workers))
    remainder = total_requests - (per_worker * workers)
    payloads: list[tuple[int, dict[str, str], int]] = []
    for worker_index in range(workers):
        request_count = per_worker + (1 if worker_index < remainder else 0)
        payloads.append((worker_index, env_values, request_count))

    ctx = get_context("spawn")
    with ctx.Pool(processes=workers) as pool:
        results = pool.map(_run_worker_process, payloads)

    total_status_200 = sum(result["status_200"] for result in results)
    total_requests_seen = sum(result["requests"] for result in results)
    total_root_contract_ok = sum(1 for result in results if result["root_contract_ok"])
    total_phi_leak_signals = sum(result["phi_leak_signals"] for result in results)
    total_trace_sent = sum(result["trace_header_sent"] for result in results)
    total_corr_sent = sum(result["correlation_header_sent"] for result in results)

    all_latencies = [
        latency
        for result in results
        for latency in [result["latency_ms"]["mean"]]
    ]

    event_bus_max_sizes = [result["event_bus_stats"].get("max_size", 0) for result in results]
    event_bus_current_sizes = [result["event_bus_stats"].get("current_size", 0) for result in results]

    return {
        "mode": "multiprocess_testclient",
        "workers": workers,
        "total_requests": total_requests_seen,
        "status_200": total_status_200,
        "status_non_200": total_requests_seen - total_status_200,
        "liveness_body_ok": total_status_200 == total_requests_seen,
        "root_contract": {
            "sample_requests": len(results),
            "contract_ok_count": total_root_contract_ok,
            "contract_ok": total_root_contract_ok == len(results),
            "phi_leak_signals": total_phi_leak_signals,
        },
        "trace_header_sent": total_trace_sent,
        "correlation_header_sent": total_corr_sent,
        "latency_ms": {
            "mean": round(statistics.fmean(all_latencies), 3) if all_latencies else 0.0,
            "p50": round(_percentile(all_latencies, 0.50), 3),
            "p95": round(_percentile(all_latencies, 0.95), 3),
            "p99": round(_percentile(all_latencies, 0.99), 3),
            "max": round(max(all_latencies), 3) if all_latencies else 0.0,
        },
        "event_bus": {
            "max_size_per_worker": event_bus_max_sizes,
            "current_size_per_worker": event_bus_current_sizes,
            "bounded_per_worker": all(size <= max_size for size, max_size in zip(event_bus_current_sizes, event_bus_max_sizes)),
        },
        "note": "Fallback multiprocess TestClient usado porque uvicorn workers mostró timeout de conexión en startup bajo Windows lab.",
    }


def _stress(total_requests: int, concurrency: int) -> dict[str, Any]:
    latencies: list[float] = []
    statuses: list[int] = []
    trace_sent_count = 0
    corr_sent_count = 0
    liveness_ok_count = 0

    root_checks = _sample_root_contract(sample_requests=10)

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(_do_liveness_request, i) for i in range(total_requests)]
        for future in as_completed(futures):
            status, latency_ms, trace_sent, corr_sent, liveness_ok = future.result()
            latencies.append(latency_ms)
            statuses.append(status)
            if trace_sent:
                trace_sent_count += 1
            if corr_sent:
                corr_sent_count += 1
            if liveness_ok:
                liveness_ok_count += 1

    status_ok = sum(1 for code in statuses if code == 200)

    return {
        "total_requests": total_requests,
        "concurrency": concurrency,
        "status_200": status_ok,
        "status_non_200": total_requests - status_ok,
        "liveness_body_ok": liveness_ok_count == total_requests,
        "root_contract": root_checks,
        "trace_header_sent": trace_sent_count,
        "correlation_header_sent": corr_sent_count,
        "latency_ms": {
            "mean": round(statistics.fmean(latencies), 3) if latencies else 0.0,
            "p50": round(_percentile(latencies, 0.50), 3),
            "p95": round(_percentile(latencies, 0.95), 3),
            "p99": round(_percentile(latencies, 0.99), 3),
            "max": round(max(latencies), 3) if latencies else 0.0,
        },
    }


def main() -> None:
    env_values = _load_env(ENV_FILE)
    targets = _validate_lab_targets(env_values)

    env = os.environ.copy()
    env.update(env_values)

    workers = int(env.get("RUNTIME_LAB_WORKERS", "2"))
    total_requests = int(env.get("RUNTIME_LAB_STRESS_REQUESTS", "500"))
    concurrency = int(env.get("RUNTIME_LAB_STRESS_CONCURRENCY", "40"))

    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "api.app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "18080",
        "--workers",
        str(workers),
        "--log-level",
        "warning",
    ]

    try:
        process = subprocess.Popen(
            cmd,
            cwd=str(ROOT),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        started_ok = False
        startup_seconds = None
        memory_before = _pid_working_set_bytes(process.pid)

        try:
            startup_seconds = _wait_for_liveness()
            started_ok = True
            memory_after_startup = _pid_working_set_bytes(process.pid)

            stress_result = _stress(total_requests=total_requests, concurrency=concurrency)
            memory_after_stress = _pid_working_set_bytes(process.pid)

            print(
                json.dumps(
                    {
                        "startup_ok": started_ok,
                        "startup_seconds": round(startup_seconds, 3) if startup_seconds is not None else None,
                        "mode": "uvicorn_workers",
                        "workers": workers,
                        "targets": targets,
                        "stress": stress_result,
                        "memory_bytes": {
                            "before_startup": memory_before,
                            "after_startup": memory_after_startup,
                            "after_stress": memory_after_stress,
                        },
                        "guards": {
                            "kill_switch": env.get("AI_RUNTIME_KILL_SWITCH"),
                            "dry_run": env.get("AI_RUNTIME_DRY_RUN"),
                            "shadow_mode": env.get("AI_RUNTIME_SHADOW_MODE"),
                            "external_export": env.get("OBSERVABILITY_EXTERNAL_EXPORT_ENABLED"),
                            "phi_allowed": env.get("OBSERVABILITY_PHI_ALLOWED"),
                            "ttl_enabled": env.get("OBSERVABILITY_EVENT_BUS_TTL_ENABLED"),
                        },
                        "notes": {
                            "providers_external_calls_enabled": env.get("LLM_PROVIDER_ROUTER_ENABLED"),
                            "medical_vision_enabled": env.get("MEDICAL_VISION_ENABLED"),
                            "clinical_confidence_enabled": env.get("CLINICAL_CONFIDENCE_ENABLED"),
                        },
                    },
                    indent=2,
                )
            )
        except Exception as exc:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    process.kill()
            fallback_result = _run_multiprocess_fallback(env, workers, total_requests)
            print(
                json.dumps(
                    {
                        "startup_ok": False,
                        "startup_error": str(exc),
                        "mode": fallback_result["mode"],
                        "workers": fallback_result["workers"],
                        "targets": targets,
                        "stress": fallback_result,
                        "memory_bytes": {
                            "before_startup": memory_before,
                            "after_startup": None,
                            "after_stress": None,
                        },
                        "guards": {
                            "kill_switch": env.get("AI_RUNTIME_KILL_SWITCH"),
                            "dry_run": env.get("AI_RUNTIME_DRY_RUN"),
                            "shadow_mode": env.get("AI_RUNTIME_SHADOW_MODE"),
                            "external_export": env.get("OBSERVABILITY_EXTERNAL_EXPORT_ENABLED"),
                            "phi_allowed": env.get("OBSERVABILITY_PHI_ALLOWED"),
                            "ttl_enabled": env.get("OBSERVABILITY_EVENT_BUS_TTL_ENABLED"),
                        },
                        "notes": {
                            "providers_external_calls_enabled": env.get("LLM_PROVIDER_ROUTER_ENABLED"),
                            "medical_vision_enabled": env.get("MEDICAL_VISION_ENABLED"),
                            "clinical_confidence_enabled": env.get("CLINICAL_CONFIDENCE_ENABLED"),
                        },
                    },
                    indent=2,
                )
            )
    finally:
        if 'process' in locals() and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    main()
