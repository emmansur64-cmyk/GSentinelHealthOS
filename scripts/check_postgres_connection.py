"""Diagnostico minimo de conectividad PostgreSQL con psycopg.

Uso:
  e:/GSentinelHealthOS/.venv/Scripts/python.exe scripts/check_postgres_connection.py

Variables soportadas:
  - DATABASE_URL (preferida)
  - PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE (fallback)
"""

from __future__ import annotations

import os
import sys
import traceback
from typing import Tuple

import psycopg


def _normalize_dsn(raw: str) -> str:
    """Convierte URLs estilo SQLAlchemy a DSN compatible con psycopg."""
    if raw.startswith("postgresql+psycopg://"):
        return "postgresql://" + raw[len("postgresql+psycopg://") :]
    if raw.startswith("postgresql+asyncpg://"):
        return "postgresql://" + raw[len("postgresql+asyncpg://") :]
    return raw


def _build_dsn() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return _normalize_dsn(database_url)

    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")
    user = os.getenv("PGUSER", "sentinel")
    password = os.getenv("PGPASSWORD", "sentinel_password")
    dbname = os.getenv("PGDATABASE", "sentinel_health")
    return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"


def _classify_error(msg: str) -> Tuple[str, str]:
    lower = msg.lower()

    if "connection refused" in lower:
        return (
            "connection refused",
            "El servidor PostgreSQL no esta aceptando conexiones en host/puerto indicado (servicio caido o puerto incorrecto).",
        )
    if "timeout" in lower or "timed out" in lower:
        return (
            "timeout",
            "La conexion expiro por red/host inaccesible/firewall o latencia alta.",
        )
    if (
        "password authentication failed" in lower
        or "authentication failed" in lower
        or "invalid_password" in lower
        or "28p01" in lower
    ):
        return (
            "auth failed",
            "Usuario o password invalidos para la base de datos destino.",
        )

    return ("unknown", "Error no clasificado automaticamente; revisar detalle completo.")


def main() -> int:
    dsn = _build_dsn()
    print("[INFO] Probando conexion PostgreSQL...")
    print(f"[INFO] DSN: {dsn}")

    try:
        with psycopg.connect(dsn, connect_timeout=5, autocommit=False) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                row = cur.fetchone()
        print(f"[OK] Conexion exitosa. SELECT 1 => {row[0] if row else None}")
        return 0

    except Exception as exc:
        error_text = str(exc)
        kind, interpretation = _classify_error(error_text)
        print("[ERROR] Fallo la conexion o consulta.")
        print(f"[ERROR] Tipo detectado: {kind}")
        print(f"[ERROR] Interpretacion: {interpretation}")
        print(f"[ERROR] Detalle: {error_text}")
        print("[ERROR] Traceback:")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
