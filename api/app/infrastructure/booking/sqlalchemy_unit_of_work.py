from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


class SqlAlchemyUnitOfWork:
    """Explicit Unit of Work for application use-cases.

    This adapter is intentionally defensive to support gradual migration while
    legacy services still manage parts of their own transactions.
    """

    def __init__(self, session: AsyncSession):
        self._session = session
        self._started_transaction = False

    async def __aenter__(self) -> "SqlAlchemyUnitOfWork":
        if not self._session.in_transaction():
            await self._session.begin()
            self._started_transaction = True
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if exc is not None:
            await self.rollback()
            return
        if self._started_transaction and self._session.in_transaction():
            await self._session.commit()

    async def commit(self) -> None:
        if self._session.in_transaction():
            await self._session.commit()

    async def rollback(self) -> None:
        if self._session.in_transaction():
            await self._session.rollback()
