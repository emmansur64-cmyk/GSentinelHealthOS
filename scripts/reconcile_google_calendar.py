#!/usr/bin/env python
"""One-shot reconciliation job for DB <-> Google Calendar consistency."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(str(project_root))

from api.app.db.session import async_session_local
from api.app.services.google_calendar_reconciliation_service import GoogleCalendarReconciliationService


async def run_once(hours: int = 48, limit: int = 500) -> None:
    async with async_session_local() as session:
        service = GoogleCalendarReconciliationService(session)
        summary = await service.reconcile_recent(hours=hours, limit=limit)
        data = summary.as_dict()
        print(
            "Google reconcile "
            f"scanned={data['scanned']} "
            f"inconsistencies={data['inconsistencies_detected']} "
            f"corrected={data['corrected']} "
            f"failed={data['failed']}"
        )


if __name__ == "__main__":
    hours = int(os.getenv("GOOGLE_RECONCILE_HOURS", "48"))
    limit = int(os.getenv("GOOGLE_RECONCILE_LIMIT", "500"))
    asyncio.run(run_once(hours=max(1, hours), limit=max(1, limit)))
