from .types import ReviewRiskLevel

_RISK_ORDER: dict[ReviewRiskLevel, int] = {
    "unknown": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


def normalize_review_risk_level(value: str | None) -> ReviewRiskLevel:
    if value in _RISK_ORDER:
        return value  # type: ignore[return-value]
    return "unknown"


def is_risk_at_least(value: ReviewRiskLevel, minimum: ReviewRiskLevel) -> bool:
    return _RISK_ORDER[value] >= _RISK_ORDER[minimum]
