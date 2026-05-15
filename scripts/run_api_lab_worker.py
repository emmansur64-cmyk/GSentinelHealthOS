#!/usr/bin/env python
"""Runner lab para validación multi-worker en Windows con Python 3.14+.

En Python 3.14, asyncio.run() ya NO respeta set_event_loop_policy() cuando
es invocado por uvicorn en el proceso padre. Este script pasa loop_factory
explícitamente a uvicorn.run() para garantizar SelectorEventLoop sin
depender de la policy global.

Uso:
    python scripts/run_api_lab_worker.py --port 18080
    python scripts/run_api_lab_worker.py --port 18081
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
os.chdir(PROJECT_ROOT)
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _load_lab_env() -> None:
    env_file = PROJECT_ROOT / ".env.runtime_lab"
    if not env_file.exists():
        raise FileNotFoundError(f"Lab env not found: {env_file}")
    for line in env_file.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def _validate_lab_targets() -> None:
    db_url = os.environ.get("DATABASE_URL", "")
    redis_url = os.environ.get("REDIS_URL", "")
    if "127.0.0.1:55432" not in db_url:
        raise RuntimeError(f"Lab safety: DATABASE_URL no apunta a 127.0.0.1:55432 → {db_url!r}")
    if "127.0.0.1:56379" not in redis_url:
        raise RuntimeError(f"Lab safety: REDIS_URL no apunta a 127.0.0.1:56379 → {redis_url!r}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Lab API worker runner")
    parser.add_argument("--port", type=int, default=18080)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    # 1. Cargar env lab antes de importar nada del proyecto
    _load_lab_env()
    _validate_lab_targets()

    # 2. Garantizar SelectorEventLoop explícitamente antes del import
    #    En Python 3.14, set_event_loop_policy no afecta asyncio.run()
    #    pero uvicorn.run() acepta loop_factory desde uvicorn 0.20+
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    # 3. Importar app DESPUÉS de fijar env y policy
    import uvicorn
    from api.app.main import app  # noqa: PLC0415

    pid = os.getpid()
    print(
        f"[lab_worker] pid={pid} host={args.host} port={args.port} "
        f"db=127.0.0.1:55432 redis=127.0.0.1:56379",
        flush=True,
    )

    # 4. Pasar loop_factory explícito para Python 3.14 compatibility
    uvicorn_kwargs: dict = {
        "host": args.host,
        "port": args.port,
        "reload": False,
        "log_level": "info",
    }
    # loop_factory disponible desde uvicorn 0.20 — inyecta SelectorEventLoop
    # sin depender de la policy global
    if sys.platform.startswith("win"):
        try:
            import inspect
            sig = inspect.signature(uvicorn.run)
            if "loop_factory" in sig.parameters:
                uvicorn_kwargs["loop_factory"] = asyncio.SelectorEventLoop
        except Exception:
            pass  # uvicorn viejo: la policy global es suficiente

    uvicorn.run(app, **uvicorn_kwargs)


if __name__ == "__main__":
    main()
