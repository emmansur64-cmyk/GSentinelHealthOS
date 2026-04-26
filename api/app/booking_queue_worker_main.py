"""Entrypoint para worker de cola de reservas."""

from __future__ import annotations

import asyncio
import os

from api.app.services import BookingQueueWorker


async def main() -> None:
    shard = int(os.getenv("BOOKING_WORKER_SHARD", "0"))
    worker = BookingQueueWorker(shard=shard)
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
