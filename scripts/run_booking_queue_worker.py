#!/usr/bin/env python
"""Arranca worker de cola de reservas para un shard determinado."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(str(project_root))

from api.app.services import BookingQueueWorker


async def main() -> None:
    shard = int(os.getenv("BOOKING_WORKER_SHARD", "0"))
    worker = BookingQueueWorker(shard=shard)
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
