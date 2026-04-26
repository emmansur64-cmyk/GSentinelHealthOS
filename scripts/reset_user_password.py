#!/usr/bin/env python
"""Resetea password de usuario interno usando hash bcrypt (idempotente)."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from sqlalchemy import select

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(str(project_root))

from api.app.core.security import get_password_hash
from api.app.db.session import async_session_local
from api.app.models import User


def _configure_windows_event_loop() -> None:
    if sys.platform.startswith("win") and hasattr(asyncio, "WindowsSelectorEventLoopPolicy"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


async def reset_user_password(username: str, plain_password: str) -> int:
    async with async_session_local() as session:
        user = (await session.execute(select(User).where(User.username == username))).scalars().first()
        if not user:
            return 1

        user.hashed_password = get_password_hash(plain_password)
        user.is_active = True
        await session.commit()
        return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reset password de usuario interno")
    parser.add_argument("--username", default=os.getenv("RESET_USERNAME", "admin"), help="Usuario a actualizar")
    parser.add_argument(
        "--password",
        default=os.getenv("RESET_PASSWORD"),
        help="Password plano a hashear",
    )
    args = parser.parse_args()
    if not args.password:
        parser.error("Debes pasar --password o definir RESET_PASSWORD")
    return args


if __name__ == "__main__":
    _configure_windows_event_loop()
    args = parse_args()
    code = asyncio.run(reset_user_password(args.username, args.password))
    if code == 0:
        print(f"Password reseteado con hash bcrypt para usuario='{args.username}'")
    else:
        print(f"Usuario no encontrado: '{args.username}'")
    raise SystemExit(code)
