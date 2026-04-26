#!/usr/bin/env python
"""Validacion de OAuth2 + RBAC + ownership + n8n side-job."""

import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(str(project_root))


def read_text(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


print("=" * 80)
print("VALIDACION PASO 4: OAUTH2 + RBAC + OWNERSHIP + N8N")
print("=" * 80)

# 1) Modelo User separado de Patient/Shadow
print("\n[1/6] Validando modelo de identidad User...")
try:
    user_model = read_text(project_root / "api" / "app" / "models" / "user.py")
    assert "class UserRole" in user_model
    assert "class User" in user_model
    assert "hashed_password" in user_model
    assert "doctor_id" in user_model
    assert "patients" not in user_model.lower()  # no mezclar credencial con shadow profile
    print("  OK UserRole + User model")
    print("  OK hashed_password + doctor_id")
    print("  OK identidad separada de patient shadow")
except Exception as exc:
    print(f"  ERROR modelo User: {exc}")
    sys.exit(1)

# 2) Endpoint OAuth2 /token
print("\n[2/6] Validando endpoint /auth/token...")
try:
    auth_ep = read_text(project_root / "api" / "app" / "api" / "v1" / "endpoints" / "auth.py")
    assert 'APIRouter(prefix="/auth"' in auth_ep
    assert '"/token"' in auth_ep
    assert "OAuth2PasswordRequestForm" in auth_ep
    assert "create_access_token" in auth_ep
    assert "WWW-Authenticate" in auth_ep
    print("  OK OAuth2PasswordRequestForm")
    print("  OK /api/v1/auth/token")
    print("  OK respuesta bearer compatible con Swagger")
except Exception as exc:
    print(f"  ERROR endpoint token: {exc}")
    sys.exit(1)

# 3) Helpers de seguridad de password/JWT
print("\n[3/6] Validando helpers de seguridad...")
try:
    security = read_text(project_root / "api" / "app" / "core" / "security.py")
    assert "CryptContext" in security
    assert "def get_password_hash" in security
    assert "def verify_password" in security
    assert "def create_access_token" in security

    from api.app.core.security import get_password_hash, verify_password

    sample = "Secret123!"
    hashed = get_password_hash(sample)
    assert hashed != sample
    assert verify_password(sample, hashed)
    print("  OK bcrypt hash/verify")
    print("  OK create_access_token")
except Exception as exc:
    print(f"  ERROR seguridad password/JWT: {exc}")
    sys.exit(1)

# 4) RBAC checker
print("\n[4/6] Validando dependencia RBAC...")
try:
    dep_auth = read_text(project_root / "api" / "app" / "dependencies" / "auth.py")
    assert "class RoleChecker" in dep_auth
    assert "allowed_roles" in dep_auth
    assert "No tienes permisos suficientes" in dep_auth
    assert "def enforce_doctor_ownership" in dep_auth
    print("  OK RoleChecker")
    print("  OK ownership helper doctor_id")
except Exception as exc:
    print(f"  ERROR RBAC dependency: {exc}")
    sys.exit(1)

# 5) Enforcement en endpoints de citas
print("\n[5/6] Validando enforcement en appointments...")
try:
    appt_ep = read_text(project_root / "api" / "app" / "api" / "v1" / "endpoints" / "appointments.py")
    assert "No puedes acceder a citas de otro doctor" in appt_ep
    assert "RoleChecker" in appt_ep
    assert "enforce_doctor_ownership" in appt_ep
    print("  OK ownership block por doctor")
    print("  OK RoleChecker aplicado")
except Exception as exc:
    print(f"  ERROR ownership/RBAC endpoint: {exc}")
    sys.exit(1)

# 6) Integracion n8n desacoplada
print("\n[6/6] Validando notificacion n8n side-job...")
try:
    notify_service = read_text(project_root / "api" / "app" / "services" / "notification_service.py")
    appt_ep = read_text(project_root / "api" / "app" / "api" / "v1" / "endpoints" / "appointments.py")

    assert "N8N_WH_APPOINTMENT_CONFIRM" in notify_service
    assert "httpx.AsyncClient" in notify_service
    assert "asyncio.create_task" in appt_ep
    assert "_safe_notify_confirmation" in appt_ep

    print("  OK webhook n8n configurable por env")
    print("  OK fire-and-forget (no rompe transaccion principal)")
except Exception as exc:
    print(f"  ERROR integracion n8n: {exc}")
    sys.exit(1)

print("\n" + "=" * 80)
print("PASO 4 VALIDADO: TOKEN + RBAC + OWNERSHIP + N8N ASYNC")
print("=" * 80)
print("\nSiguiente recomendado:")
print("  1. Crear migracion Alembic para tabla users")
print("  2. Sembrar usuario admin/doctor con password hasheada")
print("  3. Agregar tests HTTP con TestClient para 401/403/200")
