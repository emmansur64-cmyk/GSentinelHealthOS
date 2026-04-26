#!/usr/bin/env python
"""Periodic scheduler for Google Calendar reconciliation."""

from __future__ import annotations

import asyncio
import os
import signal

from reconcile_google_calendar import run_once


STOP_EVENT = asyncio.Event()


def _handle_stop_signal(_: int, __) -> None:
    STOP_EVENT.set()


def _register_signals() -> None:
    for sig_name in ("SIGINT", "SIGTERM"):
        sig = getattr(signal, sig_name, None)
        if sig is not None:
            signal.signal(sig, _handle_stop_signal)


async def run_scheduler(interval_seconds: int, hours: int, limit: int) -> None:
    while not STOP_EVENT.is_set():
        try:
            await run_once(hours=hours, limit=limit)
        except Exception as exc:
            print(f"Google reconciliation scheduler error: {exc}")

        try:
            await asyncio.wait_for(STOP_EVENT.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue


if __name__ == "__main__":
    interval = int(os.getenv("GOOGLE_RECONCILE_INTERVAL_SECONDS", "900"))
    hours = int(os.getenv("GOOGLE_RECONCILE_HOURS", "48"))
    limit = int(os.getenv("GOOGLE_RECONCILE_LIMIT", "500"))

    _register_signals()
    asyncio.run(
        run_scheduler(
            interval_seconds=max(60, interval),
            hours=max(1, hours),
            limit=max(1, limit),
        )
    )
