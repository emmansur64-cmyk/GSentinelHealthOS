import argparse
import json
import random
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List


@dataclass(frozen=True)
class IncidentProfile:
    incident_message: str
    source: str
    original_type: str
    base_severity: str
    diagnosis_code: str
    primary_strategy: str
    primary_action: str
    success_probability: float
    interval_minutes: int


PROFILES: Dict[str, IncidentProfile] = {
    "retry_with_backoff": IncidentProfile(
        incident_message="db timeout",
        source="payments_api",
        original_type="system.timeout",
        base_severity="medium",
        diagnosis_code="TRANSIENT_SYSTEM_ERROR",
        primary_strategy="error",
        primary_action="retry_with_backoff",
        success_probability=0.72,
        interval_minutes=18,
    ),
    "restart_service": IncidentProfile(
        incident_message="service crash detected",
        source="worker_scheduler",
        original_type="system.error",
        base_severity="high",
        diagnosis_code="DEGRADED_SERVICE",
        primary_strategy="recovery",
        primary_action="restart_service",
        success_probability=0.63,
        interval_minutes=24,
    ),
    "scale_up": IncidentProfile(
        incident_message="cpu saturation alert",
        source="autoscaler",
        original_type="resource.warning",
        base_severity="high",
        diagnosis_code="RESOURCE_EXHAUSTION",
        primary_strategy="capacity",
        primary_action="scale_up",
        success_probability=0.78,
        interval_minutes=20,
    ),
    "manual_intervention": IncidentProfile(
        incident_message="security anomaly detected",
        source="security_gateway",
        original_type="security.alert",
        base_severity="critical",
        diagnosis_code="CRITICAL_SECURITY_INCIDENT",
        primary_strategy="containment",
        primary_action="manual_intervention",
        success_probability=0.46,
        interval_minutes=35,
    ),
}

SEVERITY_WEIGHTS: Dict[str, Dict[str, float]] = {
    "retry_with_backoff": {"low": 0.20, "medium": 0.55, "high": 0.20, "critical": 0.05},
    "restart_service": {"low": 0.10, "medium": 0.25, "high": 0.50, "critical": 0.15},
    "scale_up": {"low": 0.10, "medium": 0.30, "high": 0.45, "critical": 0.15},
    "manual_intervention": {"low": 0.05, "medium": 0.15, "high": 0.35, "critical": 0.45},
}

NOISE_ACTIONS: List[str] = ["retry_with_backoff", "restart_service", "scale_up", "manual_intervention"]
STRATEGY_BY_ACTION: Dict[str, str] = {
    "retry_with_backoff": "error",
    "restart_service": "recovery",
    "scale_up": "capacity",
    "manual_intervention": "containment",
}


def weighted_choice(weight_map: Dict[str, float]) -> str:
    keys = list(weight_map.keys())
    weights = list(weight_map.values())
    return random.choices(keys, weights=weights, k=1)[0]


def iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def generate_synthetic_dataset(total_incidents: int, seed: int, noise_level: float) -> Dict[str, List[dict]]:
    random.seed(seed)

    actions = list(PROFILES.keys())
    base_per_class = total_incidents // len(actions)
    remainder = total_incidents % len(actions)

    class_targets = {action: base_per_class for action in actions}
    for action in actions[:remainder]:
        class_targets[action] += 1

    generated_count = defaultdict(int)
    incidents: List[dict] = []
    outcomes: List[dict] = []
    audits: List[dict] = []

    now = datetime.now(timezone.utc)
    current_ts = now - timedelta(days=14)

    incident_idx = 0
    for action in actions:
        profile = PROFILES[action]
        target_count = class_targets[action]

        for _ in range(target_count):
            incident_idx += 1
            event_id = f"incident-synth-{incident_idx:05d}"

            burst_multiplier = 0.35 if random.random() < 0.18 else 1.0
            jitter = random.uniform(0.6, 1.4)
            delta_minutes = max(1, int(profile.interval_minutes * burst_multiplier * jitter))
            current_ts += timedelta(minutes=delta_minutes)

            severity = weighted_choice(SEVERITY_WEIGHTS[action])
            retry_count = random.randint(0, 4) if action != "manual_intervention" else random.randint(1, 5)
            frequency_1h = max(1, int(random.gauss(3 + retry_count, 1.2)))
            frequency_24h = max(frequency_1h, int(frequency_1h * random.uniform(2.0, 5.0)))
            frequency_7d = max(frequency_24h, int(frequency_24h * random.uniform(2.0, 4.0)))

            chosen_action = action
            if random.random() < noise_level:
                chosen_action = random.choice(NOISE_ACTIONS)

            strategy = STRATEGY_BY_ACTION.get(chosen_action, profile.primary_strategy)
            confidence = round(max(0.35, min(0.97, random.gauss(0.78, 0.12))), 2)

            success_bias = {
                "low": 0.08,
                "medium": 0.03,
                "high": -0.06,
                "critical": -0.12,
            }[severity]
            success_probability = max(0.08, min(0.95, profile.success_probability + success_bias))
            success = random.random() < success_probability

            if random.random() < noise_level * 0.5:
                success = not success

            logs_count = max(0, int(random.gauss(5 if severity in ("low", "medium") else 9, 2)))
            metrics_count = max(0, int(random.gauss(4 if severity in ("low", "medium") else 8, 2)))

            incident_payload = {
                "incident": {
                    "id": event_id,
                    "source": profile.source,
                    "message": profile.incident_message,
                    "timestamp": iso_utc(current_ts),
                    "metadata": {
                        "data": {
                            "severity": severity,
                            "frequency_1h": frequency_1h,
                            "frequency_24h": frequency_24h,
                            "frequency_7d": frequency_7d,
                            "retry_count": retry_count,
                        },
                        "logs": [f"{severity.upper()} signal {i}" for i in range(logs_count)],
                        "metrics": {
                            "cpu": round(random.uniform(25, 95), 2),
                            "memory": round(random.uniform(30, 98), 2),
                            "latency_ms": round(random.uniform(60, 1800), 2),
                            "errors_last_5m": random.randint(0, 18),
                        },
                        "originalType": profile.original_type,
                    },
                },
                "decision": {
                    "strategy": strategy,
                    "action": chosen_action,
                    "confidence": confidence,
                    "reason": (
                        f"Synthetic bootstrap decision for {profile.diagnosis_code} "
                        f"(severity={severity}, freq1h={frequency_1h}, retries={retry_count})"
                    ),
                },
                "result": {
                    "success": success,
                    "action": chosen_action,
                    "details": "SYNTHETIC_GENERATOR",
                    "rollbackSuggested": (not success) and chosen_action != "manual_intervention",
                },
                "storedAt": iso_utc(current_ts + timedelta(seconds=random.randint(3, 40))),
            }
            incidents.append(incident_payload)

            outcomes.append(
                {
                    "action": chosen_action,
                    "outcome": "success" if success else "failure",
                    "recordedAt": incident_payload["storedAt"],
                    "incidentId": event_id,
                }
            )

            audits.append(
                {
                    "incidentId": event_id,
                    "source": profile.source,
                    "status": "SUCCESS" if success else "FAILED",
                    "diagnosisCode": profile.diagnosis_code,
                    "decisionAction": chosen_action,
                    "actionType": "AUTOMATED" if chosen_action != "manual_intervention" else "MANUAL",
                    "createdAt": incident_payload["storedAt"],
                }
            )

            generated_count[chosen_action] += 1

    incidents.sort(key=lambda item: item["incident"]["timestamp"])
    outcomes.sort(key=lambda item: item["recordedAt"])
    audits.sort(key=lambda item: item["createdAt"])

    return {
        "incidents": incidents,
        "outcomes": outcomes,
        "audits": audits,
        "class_distribution": dict(generated_count),
    }


def write_json(path: Path, payload: List[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate realistic synthetic incidents/outcomes for ML bootstrap.")
    parser.add_argument("--count", type=int, default=240, help="Total incidents to generate (default: 240)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    parser.add_argument(
        "--noise",
        type=float,
        default=0.08,
        help="Controlled noise level in [0,1] for action/outcome perturbation (default: 0.08)",
    )
    parser.add_argument("--data-dir", type=str, default="data", help="Target data directory (default: data)")
    args = parser.parse_args()

    if args.count < 200:
        raise ValueError("count must be >= 200 to satisfy bootstrap requirements")
    if not (0.0 <= args.noise <= 1.0):
        raise ValueError("noise must be between 0.0 and 1.0")

    dataset = generate_synthetic_dataset(total_incidents=args.count, seed=args.seed, noise_level=args.noise)

    data_dir = Path(args.data_dir)
    write_json(data_dir / "incidents.json", dataset["incidents"])
    write_json(data_dir / "outcomes.json", dataset["outcomes"])
    write_json(data_dir / "audit.json", dataset["audits"])

    print("Synthetic dataset generated successfully")
    print(f"  Incidents: {len(dataset['incidents'])}")
    print(f"  Outcomes:  {len(dataset['outcomes'])}")
    print(f"  Audits:    {len(dataset['audits'])}")
    print(f"  Distribution by action: {dataset['class_distribution']}")
    print(f"  Saved to: {data_dir.resolve()}")


if __name__ == "__main__":
    main()
