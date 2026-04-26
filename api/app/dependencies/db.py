from typing import AsyncGenerator
from api.app.db.session import async_session_local
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependencia para obtener una sesión de DB asíncrona.
    Se usa en los endpoints de FastAPI con: db: AsyncSession = Depends(get_db)
    """
    async with async_session_local() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
