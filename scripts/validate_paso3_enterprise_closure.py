#!/usr/bin/env python
"""Valida cierre enterprise: Outbox confiable + Alembic inicializado."""

import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(str(project_root))


def read_text(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


print("=" * 84)
print("CIERRE PASO 3 ENTERPRISE: OUTBOX + ALEMBIC")
print("=" * 84)

checks = [
    project_root / "api" / "app" / "models" / "models.py",
    project_root / "api" / "app" / "services" / "appointment_service.py",
    project_root / "api" / "app" / "services" / "outbox_service.py",
    project_root / "scripts" / "process_notification_outbox.py",
    project_root / "alembic.ini",
    project_root / "alembic" / "env.py",
    project_root / "alembic" / "versions" / "20260401_0001_users_outbox.py",
]

for file_path in checks:
    if not file_path.exists():
        print(f"ERROR falta archivo: {file_path}")
        sys.exit(1)

models = read_text(checks[0])
appt_service = read_text(checks[1])
outbox_service = read_text(checks[2])
processor = read_text(checks[3])
alembic_env = read_text(checks[5])
revision = read_text(checks[6])

assert "class NotificationOutbox" in models
assert "enqueue_appointment_confirmation" in appt_service
assert "create_task" not in appt_service
assert "dispatch_batch" in outbox_service
assert "next_attempt_at" in outbox_service
assert "process_once" in processor
assert "target_metadata = Base.metadata" in alembic_env
assert "revision: str = \"20260401_0001\"" in revision
assert "notification_outbox" in revision and "users" in revision

print("OK Outbox model + enqueue transaccional")
print("OK Processor con reintentos")
print("OK create_task removido del flujo critico")
print("OK Alembic inicializado con revision")
print("CIERRE ENTERPRISE VALIDADO")
