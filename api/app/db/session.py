import importlib
import sys
from sqlalchemy import text
from sqlalchemy.exc import InterfaceError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from api.app.core.config import settings

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
    "pool_size": 10,
    "max_overflow": 0,
}

if not is_sqlite:
    engine_kwargs["connect_args"] = {"connect_timeout": 5}

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


async def validate_async_database_runtime() -> None:
    """Verifica compatibilidad del driver async en el loop actual."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except InterfaceError as exc:
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
        raise


async def get_db() -> AsyncSession:
    """FastAPI dependency: get async database session."""
    async with async_session_local() as session:
        try:
            yield session
        finally:
            await session.close()
