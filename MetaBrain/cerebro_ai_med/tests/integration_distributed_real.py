from __future__ import annotations

import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import requests


@dataclass(frozen=True)
class ServiceProc:
    name: str
    process: subprocess.Popen[str]
    live_url: str


def _wait_ready(url: str, timeout_seconds: float = 30.0) -> None:
    deadline = time.time() + timeout_seconds
    last_error = ""

    while time.time() < deadline:
        try:
            response = requests.get(url, timeout=2.0)
            if response.status_code == 200:
                return
            last_error = f"status={response.status_code} body={response.text[:200]}"
        except Exception as exc:
            last_error = str(exc)
        time.sleep(0.5)

    raise RuntimeError(f"service_not_ready:{url}:{last_error}")


def _start_service(name: str, app: str, port: int, env: dict[str, str]) -> ServiceProc:
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        app,
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "--workers",
        "1",
    ]
    process = subprocess.Popen(cmd, env=env)
    return ServiceProc(name=name, process=process, live_url=f"http://127.0.0.1:{port}/health/live")


def _stop_services(services: list[ServiceProc]) -> None:
    for svc in services:
        if svc.process.poll() is None:
            svc.process.terminate()
    for svc in services:
        if svc.process.poll() is None:
            try:
                svc.process.wait(timeout=10)
            except Exception:
                svc.process.kill()


def run_real_validation() -> None:
    api_key = "real-integration-key"

    base_env = os.environ.copy()
    base_env["CEREBRO_API_KEY"] = api_key
    base_env["CEREBRO_RATE_LIMIT_ENABLED"] = "false"
    base_env["CEREBRO_ASYNC_ENABLED"] = "false"
    base_env["INFERENCE_SERVICE_URL"] = "http://127.0.0.1:8101"
    base_env["DECISION_SERVICE_URL"] = "http://127.0.0.1:8102"
    base_env["NLG_SERVICE_URL"] = "http://127.0.0.1:8103"
    memory_file = Path("e:/MetaBrain/data/processed/memory_history_real_validation.jsonl")
    memory_file.parent.mkdir(parents=True, exist_ok=True)
    if memory_file.exists():
        memory_file.unlink()
    base_env["CEREBRO_MEMORY_HISTORY_PATH"] = str(memory_file)

    services: list[ServiceProc] = []
    try:
        services.append(_start_service("inference", "services.inference_service.main:app", 8101, base_env))
        services.append(_start_service("decision", "services.decision_service.main:app", 8102, base_env))
        services.append(_start_service("nlg", "services.nlg_service.main:app", 8103, base_env))
        services.append(_start_service("gateway", "services.api_gateway.main:app", 8100, base_env))

        for svc in services:
            _wait_ready(svc.live_url, timeout_seconds=45.0)

        payload = {
            "input_type": "text",
            "modality": "TEXT",
            "text": "Paciente con disnea progresiva, dolor toracico y fiebre alta"
        }
        response = requests.post("http://127.0.0.1:8100/analyze", json=payload, headers={"X-API-Key": api_key}, timeout=30.0)
        if response.status_code != 200: raise RuntimeError(f"fail:{response.status_code}:{response.text}")
        data = response.json()
        assert isinstance(data["nlg_output"]["text"], str) and len(data["nlg_output"]["text"]) > 20

        history_response = requests.get(
            "http://127.0.0.1:8100/memory/history?limit=5",
            headers={"X-API-Key": api_key},
            timeout=30.0,
        )
        if history_response.status_code != 200:
            raise RuntimeError(f"history_fail:{history_response.status_code}:{history_response.text}")
        history = history_response.json()
        assert history["total_in_memory"] >= 1
        assert len(history["items"]) >= 1
        assert history["items"][-1]["embedding_slot"]["status"] == "pending"
        assert history["items"][-1]["embedding_slot"]["vector_ref"]

        print("REAL_DISTRIBUTED_PIPELINE_AND_MEMORY_OK")
        print("risk_level=", data["decision_output"]["risk_level"])
        print("clinical_flag=", data["decision_output"]["clinical_flag"])
        print("fallback_used=", data["fallback_used"])
        print("nlg_preview=", data["nlg_output"]["text"][:180])
        print("memory_items=", history["total_in_memory"])
    finally:
        _stop_services(services)


if __name__ == "__main__":
    run_real_validation()
