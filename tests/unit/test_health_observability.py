"""Tests de observabilidad desacoplados de la app completa."""

from api.app.observability.health_metrics import build_health_observability


def test_build_health_observability_derives_alerts_and_ratios():
    payload = build_health_observability(
        redis_connected=True,
        queue_depths={"whatsapp_incoming": 12, "whatsapp_outgoing": 3},
        brain_metrics={
            "system_reset_total": 2,
            "lock_contention_total": 5,
            "messages_processed_total": 10,
        },
        lock_contention_threshold=0.2,
        queue_backlog_threshold=10,
        reset_ratio_threshold=0.1,
    )

    assert payload["redis_connected"] is True
    assert payload["ratios"]["lock_contention_per_processed"] == 0.5
    assert payload["ratios"]["system_reset_per_processed"] == 0.2
    assert payload["alerts"]["lock_contention_high"] is True
    assert payload["alerts"]["queue_backlog_high"] is True
    assert payload["alerts"]["system_reset_ratio_high"] is True


def test_build_health_observability_handles_empty_metrics():
    payload = build_health_observability(
        redis_connected=False,
        queue_depths={"whatsapp_incoming": None, "whatsapp_outgoing": None},
        brain_metrics={
            "system_reset_total": 0,
            "lock_contention_total": 0,
            "messages_processed_total": 0,
        },
        lock_contention_threshold=0.2,
        queue_backlog_threshold=10,
        reset_ratio_threshold=0.1,
    )

    assert payload["redis_connected"] is False
    assert payload["ratios"]["lock_contention_per_processed"] == 0.0
    assert payload["ratios"]["system_reset_per_processed"] == 0.0
    assert payload["alerts"]["lock_contention_high"] is False
    assert payload["alerts"]["queue_backlog_high"] is False
    assert payload["alerts"]["system_reset_ratio_high"] is False
