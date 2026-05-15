from typing import AsyncGenerator
from fastapi import Request
from sqlalchemy import text
from api.app.db.session import async_session_local
from sqlalchemy.ext.asyncio import AsyncSession
from api.app.dependencies.tenant import resolve_request_tenant_context


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    Dependencia para obtener una sesión de DB asíncrona.
    Se usa en los endpoints de FastAPI con: db: AsyncSession = Depends(get_db)
    """
    async with async_session_local() as session:
        try:
            tenant = resolve_request_tenant_context(request)
            await session.execute(
                text("SELECT set_config('app.current_client_id', :value, false)"),
                {"value": str(tenant.client_id) if tenant.client_id else ""},
            )
            await session.execute(
                text("SELECT set_config('app.current_clinic_id', :value, false)"),
                {"value": str(tenant.clinic_id) if tenant.clinic_id else ""},
            )
            await session.execute(
                text("SELECT set_config('app.tenant_bypass', '0', false)")
            )
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
