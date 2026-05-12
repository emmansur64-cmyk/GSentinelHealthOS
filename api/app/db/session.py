import asyncio
import importlib
import logging
import os
import sys
import time
from sqlalchemy import text
from sqlalchemy.exc import InterfaceError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from api.app.core.config import settings

_logger = logging.getLogger(__name__)

DATABASE_URL = settings.database_url

try:
    importlib.import_module("asyncpg")
except ModuleNotFoundError:
    if DATABASE_URL.startswith("postgresql+asyncpg://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)

is_sqlite = DATABASE_URL.startswith("sqlite+") or DATABASE_URL.startswith("sqlite://")

engine_kwargs = {
    "echo": True,
    "future": True,
    "isolation_level": "SERIALIZABLE",
    "pool_pre_ping": True,
    "pool_size": settings.database_pool_size,
    "max_overflow": 0,
}

if not is_sqlite:
    engine_kwargs["connect_args"] = {"connect_timeout": settings.database_connect_timeout_seconds}

engine = create_async_engine(
    DATABASE_URL,
    **engine_kwargs,
)

async_session_local = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


def _db_startup_log(
    pid: int,
    attempt: int,
    max_attempts: int,
    elapsed_ms: float,
    outcome: str,
    exc_class: str | None = None,
) -> None:
    """Log lab-safe de startup DB: nunca imprime secrets ni DSN completo."""
    try:
        parsed_host = DATABASE_URL.split("@")[-1].split("/")[0] if "@" in DATABASE_URL else "unknown"
    except Exception:
        parsed_host = "unknown"
    _logger.info(
        "[db_startup] pid=%d attempt=%d/%d host=%s connect_timeout=%ds "
        "elapsed_ms=%.1f outcome=%s exc_class=%s",
        pid,
        attempt,
        max_attempts,
        parsed_host,
        settings.database_connect_timeout_seconds,
        elapsed_ms,
        outcome,
        exc_class or "none",
    )


async def validate_async_database_runtime() -> None:
    """Verifica compatibilidad del driver async en el loop actual.

    Implementa retry con exponential backoff + jitter basado en PID para
    sobrevivir contención de conexiones en startup multi-worker.
    Cada intento está envuelto en asyncio.wait_for() para evitar que un
    connect_timeout no efectivo de psycopg deje el startup colgado.

    Falla visible (no silenciada) si se agotan todos los reintentos.
    """
    pid = os.getpid()
    max_attempts = 5
    base_delay = 0.4
    max_delay = 5.0
    # Jitter basado en PID para escalonar workers que arrancan simultáneamente
    pid_jitter = (pid % 13) * 0.05  # 0..0.60 s, determinístico por proceso

    # Timeout asyncio = connect_timeout + 2s margen de negociación
    asyncio_timeout = float(settings.database_connect_timeout_seconds) + 2.0

    last_exc: BaseException | None = None
    for attempt in range(1, max_attempts + 1):
        t0 = time.perf_counter()
        try:
            async with asyncio.timeout(asyncio_timeout):
                async with engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            _db_startup_log(pid, attempt, max_attempts, elapsed_ms, "ok")
            return
        except InterfaceError as exc:
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            _db_startup_log(pid, attempt, max_attempts, elapsed_ms, "interface_error", type(exc).__name__)
            if (
                sys.platform.startswith("win")
                and "ProactorEventLoop" in str(exc)
                and DATABASE_URL.startswith("postgresql+psycopg://")
            ):
                raise RuntimeError(
                    "Runtime no compatible detectado: Windows + Python 3.14+ con "
                    "postgresql+psycopg bajo ProactorEventLoop. Inicia la API con "
                    "scripts/run_api_server.py o usa Python 3.13/3.12 para uvicorn directo."
                ) from exc
            last_exc = exc
        except (OperationalError, asyncio.TimeoutError, OSError) as exc:
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            _db_startup_log(pid, attempt, max_attempts, elapsed_ms, "retryable_error", type(exc).__name__)
            last_exc = exc
        except Exception as exc:  # noqa: BLE001
            # Captura psycopg.errors.ConnectionTimeout y otros no-SQLAlchemy
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            exc_cls = type(exc).__name__
            _db_startup_log(pid, attempt, max_attempts, elapsed_ms, "retryable_error", exc_cls)
            last_exc = exc

        if attempt < max_attempts:
            delay = min(base_delay * (2 ** (attempt - 1)), max_delay) + pid_jitter
            _logger.warning(
                "[db_startup] pid=%d attempt=%d/%d FAILED — retry in %.2fs",
                pid, attempt, max_attempts, delay,
            )
            await asyncio.sleep(delay)

    # Agotados los reintentos — falla visible
    _logger.error(
        "[db_startup] pid=%d STARTUP FAILED after %d attempts. last_exc=%s: %s",
        pid, max_attempts, type(last_exc).__name__ if last_exc else "unknown", last_exc,
    )
    if last_exc is not None:
        raise last_exc
    raise RuntimeError(f"[db_startup] pid={pid}: DB no disponible tras {max_attempts} intentos")


async def get_db() -> AsyncSession:
    """FastAPI dependency: get async database session."""
    async with async_session_local() as session:
        try:
            yield session
        finally:
            await session.close()


async def close_async_database_runtime() -> None:
    """Cierra conexiones/pool del engine async durante shutdown de la app."""
    await engine.dispose()
