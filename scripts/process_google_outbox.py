#!/usr/bin/env python
"""Procesa eventos pendientes de google_outbox."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(str(project_root))

from api.app.db.session import async_session_local
from api.app.services.outbox_service import OutboxService


async def process_once(limit: int = 200) -> None:
    async with async_session_local() as session:
        service = OutboxService(session)
        summary = await service.dispatch_google_batch(limit=limit)
        print(
            f"Google outbox processed={summary['processed']} done={summary['done']} failed={summary['failed']}"
        )


if __name__ == "__main__":
    max_items = int(os.getenv("GOOGLE_OUTBOX_PROCESS_LIMIT", os.getenv("OUTBOX_PROCESS_LIMIT", "200")))
    asyncio.run(process_once(limit=max_items))
