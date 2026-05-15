"""metabrain.observability — production observability for MetaBrain AI backend.

Public API
----------
    from metabrain.observability import (
        get_logger,
        set_request_context,
        clear_request_context,
        OBSERVABILITY_METRICS,
        ALERT_BUS,
        GROQ_MONITOR,
        RedisCircuitBreaker,
        build_health_router,
    )

Quick integration in a FastAPI app
-----------------------------------
    from fastapi import FastAPI
    from metabrain.observability import (
        build_health_router,
        RedisCircuitBreaker,
        GROQ_MONITOR,
        ALERT_BUS,
    )

    app = FastAPI()

    @app.on_event("startup")
    async def startup():
        monitor = RedisCircuitBreaker(
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
            alert_bus=ALERT_BUS,
        )
        await monitor.start()
        app.state.redis_circuit_breaker = monitor

    @app.on_event("shutdown")
    async def shutdown():
        await app.state.redis_circuit_breaker.stop()

    app.include_router(build_health_router())
"""

from metabrain.observability.alerts import ALERT_BUS, Alert, AlertBus, AlertThresholds
from metabrain.observability.groq_monitor import GROQ_MONITOR, GroqCallSpan, GroqMonitor
from metabrain.observability.health import build_health_router
from metabrain.observability.logger import (
    ObservabilityJsonFormatter,
    clear_request_context,
    configure_observability_logging,
    get_logger,
    set_request_context,
)
from metabrain.observability.metrics import OBSERVABILITY_METRICS, ObservabilityMetrics
from metabrain.observability.redis_monitor import CircuitOpenError, CircuitState, RedisCircuitBreaker

__all__ = [
    # logger
    "get_logger",
    "set_request_context",
    "clear_request_context",
    "configure_observability_logging",
    "ObservabilityJsonFormatter",
    # metrics
    "OBSERVABILITY_METRICS",
    "ObservabilityMetrics",
    # alerts
    "ALERT_BUS",
    "Alert",
    "AlertBus",
    "AlertThresholds",
    # redis monitor
    "RedisCircuitBreaker",
    "CircuitState",
    "CircuitOpenError",
    # groq monitor
    "GROQ_MONITOR",
    "GroqMonitor",
    "GroqCallSpan",
    # health router
    "build_health_router",
]
