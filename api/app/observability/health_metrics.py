"""Funciones puras para construir payloads de observabilidad de health."""

from __future__ import annotations


def build_health_observability(
    *,
    redis_connected: bool,
    queue_depths: dict,
    brain_metrics: dict,
    lock_contention_threshold: float,
    queue_backlog_threshold: int,
    reset_ratio_threshold: float,
) -> dict:
    processed = brain_metrics.get("messages_processed_total") or 0
    lock_contentions = brain_metrics.get("lock_contention_total") or 0
    resets = brain_metrics.get("system_reset_total") or 0

    incoming_depth = queue_depths.get("whatsapp_incoming") or 0
    outgoing_depth = queue_depths.get("whatsapp_outgoing") or 0
    booking_shards = queue_depths.get("booking_shards") or {}
    booking_depths = [int(v) for v in booking_shards.values()] if isinstance(booking_shards, dict) else []
    max_queue_depth = max([incoming_depth, outgoing_depth, *booking_depths])

    lock_contention_ratio = (lock_contentions / processed) if processed > 0 else 0.0
    reset_ratio = (resets / processed) if processed > 0 else 0.0

    return {
        "redis_connected": redis_connected,
        "queue_depths": queue_depths,
        "brain_metrics": brain_metrics,
        "ratios": {
            "lock_contention_per_processed": round(lock_contention_ratio, 4),
            "system_reset_per_processed": round(reset_ratio, 4),
        },
        "alerts": {
            "lock_contention_high": lock_contention_ratio >= lock_contention_threshold,
            "queue_backlog_high": max_queue_depth >= queue_backlog_threshold,
            "system_reset_ratio_high": reset_ratio >= reset_ratio_threshold,
        },
    }
