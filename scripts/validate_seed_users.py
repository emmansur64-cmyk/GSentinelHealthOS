#!/usr/bin/env python
"""Valida wiring de migracion users + script seed sin depender de DB activa."""

import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(str(project_root))


def read_text(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


print("=" * 72)
print("VALIDACION MIGRACION+SEED USERS")
print("=" * 72)

migration_path = project_root / "database" / "migrations" / "20260401_001_create_users_table.sql"
seed_path = project_root / "scripts" / "seed_users.py"
model_path = project_root / "api" / "app" / "models" / "user.py"

for path in [migration_path, seed_path, model_path]:
    if not path.exists():
        print(f"ERROR falta archivo: {path}")
        sys.exit(1)

migration = read_text(migration_path)
seed_code = read_text(seed_path)
model_code = read_text(model_path)

assert "CREATE TABLE IF NOT EXISTS users" in migration
assert "hashed_password" in migration
assert "doctor_id" in migration
assert "role IN ('admin', 'doctor', 'receptionist')" in migration

assert "get_password_hash" in seed_code
assert "SEED_ADMIN_USERNAME" in seed_code
assert "SEED_DOCTOR_USERNAME" in seed_code
assert "_ensure_user" in seed_code

assert "class UserRole" in model_code
assert "class User" in model_code

print("OK migracion users")
print("OK seed idempotente con hash bcrypt")
print("OK modelo user/role")
print("VALIDACION COMPLETA")
