"""
Configuración compartida para todas las aplicaciones
"""

import os
from pathlib import Path
from typing import Optional


def _load_dotenv_if_available() -> None:
    """Carga .env de forma opcional para procesos que no usan BaseSettings."""
    try:
        from dotenv import load_dotenv
    except Exception:
        return

    project_root = Path(__file__).resolve().parents[1]
    load_dotenv(project_root / ".env", override=False)
    load_dotenv(project_root / ".env.local", override=True)


_load_dotenv_if_available()

# ============ DATABASE ============
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./test.db"
)

# ============ REDIS ============
REDIS_URL = os.getenv(
    "REDIS_URL",
    "redis://localhost:6379"
)

# ============ API ============
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# ============ BRAIN ============
BRAIN_HOST = os.getenv("BRAIN_HOST", "0.0.0.0")
BRAIN_PORT = int(os.getenv("BRAIN_PORT", "8001"))

# ============ GATEWAY ============
GATEWAY_HOST = os.getenv("GATEWAY_HOST", "0.0.0.0")
GATEWAY_PORT = int(os.getenv("GATEWAY_PORT", "8002"))

# ============ WHATSAPP ============
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_BUSINESS_ACCOUNT_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
WHATSAPP_PROCESSED_TTL_SECONDS = int(os.getenv("WHATSAPP_PROCESSED_TTL_SECONDS", "604800"))
WHATSAPP_OUTGOING_RATE_LIMIT = int(os.getenv("WHATSAPP_OUTGOING_RATE_LIMIT", "20"))
WHATSAPP_OUTGOING_RATE_WINDOW_SECONDS = int(
    os.getenv("WHATSAPP_OUTGOING_RATE_WINDOW_SECONDS", "60")
)
WHATSAPP_DLQ_ALERT_THRESHOLD = int(os.getenv("WHATSAPP_DLQ_ALERT_THRESHOLD", "50"))
WHATSAPP_DLQ_ALERT_WEBHOOK = os.getenv("WHATSAPP_DLQ_ALERT_WEBHOOK", "")

# ============ LOGGING ============
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", None)

# ============ ENVIRONMENT ============
ENV = os.getenv("ENV", "development")
DEBUG = ENV == "development"

# ============ CORS ============
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:8000"
).split(",")
