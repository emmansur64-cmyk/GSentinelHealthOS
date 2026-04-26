#!/usr/bin/env python
"""Worker periódico para procesar notification_outbox en producción."""

from __future__ import annotations

import asyncio
import os
import signal
from typing import Optional

from process_notification_outbox import process_once


STOP_EVENT = asyncio.Event()


def _handle_stop_signal(_: int, __) -> None:
    STOP_EVENT.set()


async def run_scheduler(interval_seconds: int, batch_limit: int) -> None:
    while not STOP_EVENT.is_set():
        try:
            await process_once(limit=batch_limit)
        except Exception as exc:
            print(f"Outbox scheduler error: {exc}")

        try:
            await asyncio.wait_for(STOP_EVENT.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue


def _register_signals() -> None:
    for sig_name in ("SIGINT", "SIGTERM"):
        sig = getattr(signal, sig_name, None)
        if sig is not None:
            signal.signal(sig, _handle_stop_signal)


if __name__ == "__main__":
    interval = int(os.getenv("OUTBOX_SCHEDULER_INTERVAL_SECONDS", "15"))
    limit = int(os.getenv("OUTBOX_PROCESS_LIMIT", "200"))

    _register_signals()
    asyncio.run(run_scheduler(interval_seconds=max(1, interval), batch_limit=max(1, limit)))
