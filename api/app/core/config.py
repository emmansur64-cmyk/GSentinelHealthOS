"""Configuración centralizada usando Pydantic BaseSettings v2."""

from typing import List
from pydantic import Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_PLACEHOLDER_SECRETS = {
    "your-secret-key-change-in-production",
    "change-me-gateway-key",
    "change-me-brain-key",
    "gateway-secret-key-change-production",
    "brain-secret-key-change-production",
    "change-me-panel-admin-key",
}


def _normalize_database_url(database_url: str) -> str:
    normalized = database_url.strip()
    if normalized.startswith("sqlite://") and not normalized.startswith("sqlite+aiosqlite://"):
        return normalized.replace("sqlite://", "sqlite+aiosqlite://", 1)
    if normalized.startswith("postgresql://"):
        return normalized.replace("postgresql://", "postgresql+psycopg://", 1)
    return normalized


class Settings(BaseSettings):
    """Configuración de la API desde variables de entorno."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # === API ===
    api_title: str = Field(default="GSentinelHealthOS API", alias="API_TITLE")
    api_version: str = Field(default="1.0.0", alias="API_VERSION")
    debug: bool = Field(default=False, alias="DEBUG")

    # === CORS ===
    # Lectura desde .env: ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173,..."
    allowed_origins: str = Field(
        default="http://localhost:3000,http://localhost:5173,http://localhost:5174",
        alias="ALLOWED_ORIGINS",
        description="Orígenes permitidos para CORS (separados por comas)"
    )
    
    # === DATABASE ===
    database_url: str = Field(
        default="",
        alias="DATABASE_URL"
    )
    database_connect_timeout_seconds: int = Field(
        default=5,
        alias="DATABASE_CONNECT_TIMEOUT_SECONDS"
    )
    database_pool_size: int = Field(
        default=10,
        alias="DATABASE_POOL_SIZE"
    )

    # === REDIS / COLAS ===
    redis_url: str = Field(
        default="redis://localhost:6379",
        alias="REDIS_URL"
    )
    booking_queue_shards: int = Field(default=16, alias="BOOKING_QUEUE_SHARDS")
    booking_queue_result_ttl_seconds: int = Field(default=86400, alias="BOOKING_QUEUE_RESULT_TTL_SECONDS")
    booking_queue_lock_ttl_ms: int = Field(default=15000, alias="BOOKING_QUEUE_LOCK_TTL_MS")

    # === JWT / AUTH ===
    jwt_secret: str = Field(
        default="",
        alias="JWT_SECRET"
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expiration_hours: int = Field(default=24, alias="JWT_EXPIRATION_HOURS")
    jwt_issuer: str = Field(default="gsentinel-api", alias="JWT_ISSUER")
    jwt_audience: str = Field(default="gsentinel-clients", alias="JWT_AUDIENCE")
    rate_limit_per_minute: int = Field(default=200, alias="RATE_LIMIT_PER_MINUTE")
    auth_cookie_secure: bool = Field(default=False, alias="AUTH_COOKIE_SECURE")
    auth_cookie_samesite: str = Field(default="lax", alias="AUTH_COOKIE_SAMESITE")
    gateway_api_key: str = Field(default="", alias="GATEWAY_API_KEY")
    brain_api_key: str = Field(default="", alias="BRAIN_API_KEY")
    # Panel Super-Admin internal key — optional, only required when panel is deployed
    panel_admin_api_key: str = Field(default="", alias="PANEL_ADMIN_API_KEY")

    # === LOGGING ===
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # === GOOGLE CALENDAR ===
    google_calendar_enabled: bool = Field(default=False, alias="GOOGLE_CALENDAR_ENABLED")
    google_calendar_auth_mode: str = Field(default="service_account", alias="GOOGLE_CALENDAR_AUTH_MODE")
    google_calendar_id: str = Field(default="primary", alias="GOOGLE_CALENDAR_ID")
    google_calendar_timezone: str = Field(default="UTC", alias="GOOGLE_CALENDAR_TIMEZONE")
    google_service_account_file: str = Field(default="", alias="GOOGLE_SERVICE_ACCOUNT_FILE")
    google_service_account_json: str = Field(default="", alias="GOOGLE_SERVICE_ACCOUNT_JSON")
    google_service_account_json_base64: str = Field(default="", alias="GOOGLE_SERVICE_ACCOUNT_JSON_BASE64")
    google_oauth_client_secret_file: str = Field(default="", alias="GOOGLE_OAUTH_CLIENT_SECRET_FILE")
    google_oauth_token_file: str = Field(default="", alias="GOOGLE_OAUTH_TOKEN_FILE")
    google_calendar_webhook_token: str = Field(default="", alias="GOOGLE_CALENDAR_WEBHOOK_TOKEN")
    google_calendar_webhook_callback_url: str = Field(default="", alias="GOOGLE_CALENDAR_WEBHOOK_CALLBACK_URL")
    google_calendar_watch_ttl_seconds: int = Field(default=86400, alias="GOOGLE_CALENDAR_WATCH_TTL_SECONDS")
    google_calendar_resilience_profile: str = Field(
        default="prod",
        alias="GOOGLE_CALENDAR_RESILIENCE_PROFILE",
    )
    google_calendar_resilience_use_profile_defaults: bool = Field(
        default=True,
        alias="GOOGLE_CALENDAR_RESILIENCE_USE_PROFILE_DEFAULTS",
    )
    google_calendar_rate_limit_rps: int = Field(default=5, alias="GOOGLE_CALENDAR_RATE_LIMIT_RPS")
    google_calendar_retry_attempts: int = Field(default=4, alias="GOOGLE_CALENDAR_RETRY_ATTEMPTS")
    google_calendar_retry_base_delay_seconds: float = Field(
        default=1.0,
        alias="GOOGLE_CALENDAR_RETRY_BASE_DELAY_SECONDS",
    )
    google_calendar_retry_max_delay_seconds: float = Field(
        default=8.0,
        alias="GOOGLE_CALENDAR_RETRY_MAX_DELAY_SECONDS",
    )
    google_calendar_retry_jitter_seconds: float = Field(
        default=0.25,
        alias="GOOGLE_CALENDAR_RETRY_JITTER_SECONDS",
    )
    google_calendar_cb_failure_threshold: int = Field(
        default=5,
        alias="GOOGLE_CALENDAR_CB_FAILURE_THRESHOLD",
    )
    google_calendar_cb_reset_timeout_seconds: float = Field(
        default=60.0,
        alias="GOOGLE_CALENDAR_CB_RESET_TIMEOUT_SECONDS",
    )
    google_calendar_cb_half_open_max_calls: int = Field(
        default=1,
        alias="GOOGLE_CALENDAR_CB_HALF_OPEN_MAX_CALLS",
    )

    # === OBSERVABILIDAD ===
    health_lock_contention_threshold: float = Field(
        default=0.2,
        alias="HEALTH_LOCK_CONTENTION_THRESHOLD"
    )
    health_queue_backlog_threshold: int = Field(
        default=100,
        alias="HEALTH_QUEUE_BACKLOG_THRESHOLD"
    )
    health_reset_ratio_threshold: float = Field(
        default=0.1,
        alias="HEALTH_RESET_RATIO_THRESHOLD"
    )
    health_providers_open_is_critical: bool = Field(
        default=True,
        alias="HEALTH_PROVIDERS_OPEN_IS_CRITICAL"
    )
    health_providers_half_open_is_degraded: bool = Field(
        default=False,
        alias="HEALTH_PROVIDERS_HALF_OPEN_IS_DEGRADED"
    )
    health_providers_unknown_is_degraded: bool = Field(
        default=True,
        alias="HEALTH_PROVIDERS_UNKNOWN_IS_DEGRADED"
    )

    # === META / WHATSAPP EMBEDDED SIGNUP ===
    meta_app_id: str = Field(default="", alias="META_APP_ID")
    meta_app_secret: str = Field(default="", alias="META_APP_SECRET")
    meta_graph_api_version: str = Field(default="v21.0", alias="META_GRAPH_API_VERSION")
    meta_oauth_redirect_uri: str = Field(default="", alias="META_OAUTH_REDIRECT_URI")
    meta_embedded_signup_configuration_id: str = Field(
        default="",
        alias="META_EMBEDDED_SIGNUP_CONFIGURATION_ID",
    )

    @property
    def origins_list(self) -> List[str]:
        """Convierte la cadena de orígenes en una lista."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        normalized = _normalize_database_url(value)
        if not normalized:
            raise ValueError("DATABASE_URL es obligatorio y debe apuntar a una base real")
        return normalized

    @field_validator("jwt_secret", "gateway_api_key", "brain_api_key")
    @classmethod
    def validate_sensitive_value(cls, value: str, info: ValidationInfo) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError(f"{info.field_name.upper()} es obligatorio")
        if normalized in _PLACEHOLDER_SECRETS:
            raise ValueError(f"{info.field_name.upper()} no puede usar un placeholder inseguro")
        return normalized

    @field_validator("auth_cookie_samesite")
    @classmethod
    def validate_auth_cookie_samesite(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"lax", "strict", "none"}:
            raise ValueError("AUTH_COOKIE_SAMESITE debe ser lax, strict o none")
        return normalized


# Instancia global de configuración
settings = Settings()
