"""Configuracion del Brain usando Pydantic Settings."""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class BrainSettings(BaseSettings):
    """Configuracion del worker y del runtime conversacional."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")
    api_base_url: str = Field(default="http://localhost:8000", alias="API_BASE_URL")
    brain_api_key: str = Field(
        default="brain-secret-key-change-production",
        alias="BRAIN_API_KEY",
    )
    incoming_queue_name: str = Field(
        default="whatsapp:incoming",
        alias="WHATSAPP_INCOMING_QUEUE",
    )
    outgoing_queue_name: str = Field(
        default="whatsapp:outgoing",
        alias="WHATSAPP_OUTGOING_QUEUE",
    )
    state_ttl_seconds: int = Field(default=86400, alias="BRAIN_STATE_TTL_SECONDS")  # 24h; configurable vía env
    default_appointment_reason: str = Field(
        default="Solicitud generada desde WhatsApp",
        alias="BRAIN_DEFAULT_APPOINTMENT_REASON",
    )
    no_show_model_path: str = Field(
        default="medical-agenda-saas/models/no_show_model.onnx",
        alias="NO_SHOW_MODEL_PATH",
    )

    # ── URLs de microservicios de IA (orquestación central) ────────────────
    dialogue_engine_url: str = Field(
        default="http://localhost:8010",
        alias="DIALOGUE_ENGINE_URL",
    )
    inference_service_url: str = Field(
        default="http://localhost:8011",
        alias="INFERENCE_SERVICE_URL",
    )
    decision_service_url: str = Field(
        default="http://localhost:8012",
        alias="DECISION_SERVICE_URL",
    )
    nlg_service_url: str = Field(
        default="http://localhost:8013",
        alias="NLG_SERVICE_URL",
    )
    # Clave interna compartida entre el brain y los microservicios de IA
    internal_services_key: str = Field(
        default="",
        alias="INTERNAL_SERVICES_KEY",
    )
    # Puerto HTTP del brain (FastAPI)
    brain_port: int = Field(default=8001, alias="BRAIN_PORT")
    brain_host: str = Field(default="0.0.0.0", alias="BRAIN_HOST")


settings = BrainSettings()