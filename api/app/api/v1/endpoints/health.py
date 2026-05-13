"""
Endpoints de salud - Health check y readiness
"""

from contextlib import suppress
from fastapi import APIRouter, Depends
from datetime import datetime
from redis.asyncio import Redis
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse

from api.app.core.config import settings
from api.app.core.security import InternalAuth, validate_api_key
from api.app.db.session import get_db
from api.app.models import NotificationOutbox
from api.app.observability.health_metrics import build_health_observability
from api.app.services.google_calendar_service import get_google_calendar_resilience_snapshot
from shared.utils.resilience import CircuitBreakerRegistry
router = APIRouter(prefix="/health", tags=["health"])


def _parse_heartbeat_age_seconds(heartbeat_value: str | None) -> float | None:
    if not heartbeat_value:
        return None
    try:
        heartbeat_dt = datetime.fromisoformat(heartbeat_value)
    except ValueError:
        return None
    return max(0.0, (datetime.utcnow() - heartbeat_dt).total_seconds())


def _booking_worker_state(*, heartbeat_age_seconds: float | None, backlog: int) -> str:
    if heartbeat_age_seconds is None:
        return "critical"
    if heartbeat_age_seconds > 30 or backlog >= settings.health_queue_backlog_threshold:
        return "degraded"
    return "healthy"


def _outbox_state(*, pending: int, failed: int, near_max_attempts: int) -> str:
    if failed > 0 and near_max_attempts > 0:
        return "critical"
    if pending >= settings.health_queue_backlog_threshold or failed > 0:
        return "degraded"
    return "healthy"


def _providers_state(circuits: dict[str, dict]) -> str:
    if not circuits:
        return "degraded" if settings.health_providers_unknown_is_degraded else "healthy"
    if any((item.get("state") == "open") for item in circuits.values()):
        return "critical" if settings.health_providers_open_is_critical else "degraded"
    if any((item.get("state") == "half_open") for item in circuits.values()):
        return "degraded" if settings.health_providers_half_open_is_degraded else "healthy"
    return "healthy"


async def _collect_redis_observability() -> dict:
    queue_depths = {
        "whatsapp_incoming": None,
        "whatsapp_outgoing": None,
        "booking_shards": {},
    }
    brain_metrics = {
        "system_reset_total": None,
        "lock_contention_total": None,
        "messages_processed_total": None,
    }
    redis_connected = False
    booking_workers = {
        "configured_shards": settings.booking_queue_shards,
        "alive_workers": 0,
        "heartbeat": {},
    }

    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        (
            incoming_depth,
            outgoing_depth,
            system_reset_total,
            lock_contention_total,
            messages_processed_total,
        ) = await redis_client.pipeline().llen("whatsapp:incoming").llen("whatsapp:outgoing").get(
            "brain:metrics:system_reset_total"
        ).get("brain:metrics:lock_contention_total").get(
            "brain:metrics:messages_processed_total"
        ).execute()

        queue_depths["whatsapp_incoming"] = int(incoming_depth)
        queue_depths["whatsapp_outgoing"] = int(outgoing_depth)

        pipe = redis_client.pipeline()
        for shard in range(max(1, settings.booking_queue_shards)):
            pipe.llen(f"appointments:booking:shard:{shard}")
            pipe.get(f"appointments:booking:worker:{shard}:heartbeat")
        booking_results = await pipe.execute()

        for shard in range(max(1, settings.booking_queue_shards)):
            depth = booking_results[2 * shard]
            heartbeat = booking_results[(2 * shard) + 1]
            queue_depths["booking_shards"][str(shard)] = int(depth)
            booking_workers["heartbeat"][str(shard)] = heartbeat
            if heartbeat:
                booking_workers["alive_workers"] += 1

        brain_metrics["system_reset_total"] = int(system_reset_total) if system_reset_total is not None else 0
        brain_metrics["lock_contention_total"] = int(lock_contention_total) if lock_contention_total is not None else 0
        brain_metrics["messages_processed_total"] = int(messages_processed_total) if messages_processed_total is not None else 0
        redis_connected = True
    except Exception:
        # El endpoint de health no debe caerse si Redis no está disponible.
        pass
    finally:
        with suppress(Exception):
            close_method = getattr(redis_client, "aclose", None)
            if close_method is not None:
                await close_method()
            else:
                await redis_client.close()

    return build_health_observability(
        redis_connected=redis_connected,
        queue_depths=queue_depths,
        brain_metrics=brain_metrics,
        lock_contention_threshold=settings.health_lock_contention_threshold,
        queue_backlog_threshold=settings.health_queue_backlog_threshold,
        reset_ratio_threshold=settings.health_reset_ratio_threshold,
    ) | {"booking_workers": booking_workers}


async def _collect_outbox_observability(db: AsyncSession) -> dict:
    try:
        pending = int(
            await db.scalar(select(func.count(NotificationOutbox.id)).where(NotificationOutbox.status == "pending"))
            or 0
        )
        failed = int(
            await db.scalar(select(func.count(NotificationOutbox.id)).where(NotificationOutbox.status == "failed"))
            or 0
        )
        near_max_attempts = int(
            await db.scalar(
                select(func.count(NotificationOutbox.id)).where(
                    and_(
                        NotificationOutbox.status == "failed",
                        NotificationOutbox.attempts >= 4,
                    )
                )
            )
            or 0
        )
        oldest_pending = await db.scalar(
            select(func.min(NotificationOutbox.created_at)).where(NotificationOutbox.status == "pending")
        )

        oldest_pending_age_seconds = None
        if oldest_pending is not None:
            oldest_pending_age_seconds = round(max(0.0, (datetime.utcnow() - oldest_pending).total_seconds()), 3)

        return {
            "status": _outbox_state(
                pending=pending,
                failed=failed,
                near_max_attempts=near_max_attempts,
            ),
            "pending": pending,
            "failed": failed,
            "near_max_attempts": near_max_attempts,
            "oldest_pending_age_seconds": oldest_pending_age_seconds,
        }
    except Exception as exc:
        return {
            "status": "unknown",
            "pending": None,
            "failed": None,
            "near_max_attempts": None,
            "oldest_pending_age_seconds": None,
            "error": str(exc),
        }


async def _collect_provider_observability() -> dict:
    circuits = await CircuitBreakerRegistry.snapshot_all()
    google_resilience = await get_google_calendar_resilience_snapshot()
    return {
        "status": _providers_state(circuits),
        "circuits": circuits,
        "google_calendar": google_resilience,
    }


@router.get("/readiness")
async def readiness(
    db: AsyncSession = Depends(get_db),
):
    """Health check público mínimo para readiness probe infra (Docker, Kubernetes, scripts).
    No expone datos operativos internos. Para métricas detalladas usar /dashboard-summary (protegido).
    """
    db_ok = False
    redis_ok = False

    with suppress(Exception):
        await db.execute(select(func.now()))
        db_ok = True

    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        await redis_client.ping()
        redis_ok = True
    except Exception:
        pass
    finally:
        with suppress(Exception):
            close_method = getattr(redis_client, "aclose", None)
            if close_method is not None:
                await close_method()
            else:
                await redis_client.close()

    overall = "ready" if (db_ok and redis_ok) else "not_ready"
    http_status = 200 if overall == "ready" else 503
    payload = {
        "status": overall,
        "timestamp": datetime.utcnow().isoformat(),
        "service": "GSentinelHealthOS API",
        "checks": {
            "database": "ok" if db_ok else "error",
            "redis": "ok" if redis_ok else "error",
        },
    }
    return JSONResponse(status_code=http_status, content=payload)


@router.get("/dashboard-summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    auth: InternalAuth = Depends(validate_api_key)
):
    """Payload resumido de salud para widgets del Dashboard - Requiere autenticación"""
    observability = await _collect_redis_observability()
    outbox = await _collect_outbox_observability(db)
    providers = await _collect_provider_observability()

    return {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "GSentinelHealthOS API",
        "redis_connected": observability["redis_connected"],
        "queues": observability["queue_depths"],
        "brain": observability["brain_metrics"],
        "booking_workers": observability.get("booking_workers", {}),
        "outbox": outbox,
        "providers": providers,
        "ratios": observability["ratios"],
        "alerts": observability["alerts"],
    }


@router.get("/outbox")
async def outbox_readiness(
    db: AsyncSession = Depends(get_db),
    auth: InternalAuth = Depends(validate_api_key)
):
    """Estado operativo del outbox para alertas de backlog y fallos - Requiere autenticación"""
    outbox = await _collect_outbox_observability(db)
    status_map = {
        "healthy": 200,
        "degraded": 503,
        "critical": 503,
        "unknown": 503,
    }
    http_status = status_map.get(str(outbox.get("status")), 503)

    payload = {
        "status": outbox.get("status", "unknown"),
        "timestamp": datetime.utcnow().isoformat(),
        "service": "GSentinelHealthOS API",
        "outbox": outbox,
    }
    return JSONResponse(status_code=http_status, content=payload)


@router.get("/providers")
async def providers_readiness(auth: InternalAuth = Depends(validate_api_key)):
    """Estado de circuit breakers de proveedores externos - Requiere autenticación"""
    providers = await _collect_provider_observability()
    http_status = 200 if providers.get("status") == "healthy" else 503
    payload = {
        "status": providers.get("status", "unknown"),
        "timestamp": datetime.utcnow().isoformat(),
        "service": "GSentinelHealthOS API",
        "providers": providers,
    }
    return JSONResponse(status_code=http_status, content=payload)


@router.get("/booking-workers")
async def booking_workers_readiness(auth: InternalAuth = Depends(validate_api_key)):
    """Estado de workers de reserva por shard con clasificación SRE - Requiere autenticación"""
    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)

    configured_shards = max(1, settings.booking_queue_shards)
    shard_states: dict[str, dict] = {}
    alive_workers = 0
    total_backlog = 0

    try:
        pipe = redis_client.pipeline()
        for shard in range(configured_shards):
            pipe.llen(f"appointments:booking:shard:{shard}")
            pipe.get(f"appointments:booking:worker:{shard}:heartbeat")
        results = await pipe.execute()

        for shard in range(configured_shards):
            backlog = int(results[2 * shard])
            heartbeat = results[(2 * shard) + 1]
            heartbeat_age_seconds = _parse_heartbeat_age_seconds(heartbeat)
            state = _booking_worker_state(
                heartbeat_age_seconds=heartbeat_age_seconds,
                backlog=backlog,
            )

            if heartbeat_age_seconds is not None:
                alive_workers += 1
            total_backlog += backlog

            shard_states[str(shard)] = {
                "state": state,
                "backlog": backlog,
                "heartbeat": heartbeat,
                "heartbeat_age_seconds": round(heartbeat_age_seconds, 3) if heartbeat_age_seconds is not None else None,
            }

        global_state = "healthy"
        if alive_workers == 0:
            global_state = "critical"
        elif any(item["state"] == "critical" for item in shard_states.values()):
            global_state = "critical"
        elif any(item["state"] == "degraded" for item in shard_states.values()):
            global_state = "degraded"

        payload = {
            "status": global_state,
            "timestamp": datetime.utcnow().isoformat(),
            "service": "GSentinelHealthOS API",
            "booking_workers": {
                "configured_shards": configured_shards,
                "alive_workers": alive_workers,
                "total_backlog": total_backlog,
                "shards": shard_states,
            },
        }
        http_status = 200 if global_state == "healthy" else 503
        return JSONResponse(status_code=http_status, content=payload)
    finally:
        with suppress(Exception):
            close_method = getattr(redis_client, "aclose", None)
            if close_method is not None:
                await close_method()
            else:
                await redis_client.close()


@router.get("/liveness")
def liveness():
    """Health check para liveness probe"""
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "GSentinelHealthOS API"
    }
