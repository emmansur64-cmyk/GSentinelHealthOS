import re

from .types import ProviderConsistencyResult, ProviderOutputSummary


def _normalize(value: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (value or "").lower())).strip()


def _similarity(left: str, right: str) -> float:
    if not left and not right:
        return 0.0
    if left == right:
        return 1.0
    left_terms = set(left.split())
    right_terms = set(right.split())
    union = len(left_terms | right_terms) or 1
    return len(left_terms & right_terms) / union


def evaluate_provider_consistency(outputs: list[ProviderOutputSummary]) -> ProviderConsistencyResult:
    usable = [item for item in outputs if item.status == "ok" and _normalize(item.content_summary)]
    unresolved = [f"{item.provider_name}:{item.status}" for item in outputs if item.status != "ok"]

    if len(usable) < 2:
        return ProviderConsistencyResult(
            providers_compared=len(usable),
            consistency_score=0.7 if len(usable) == 1 else 0.0,
            conflicts_detected=bool(unresolved),
            dominant_provider=usable[0].provider_name if usable else None,
            unresolved_conflicts=unresolved,
        )

    comparisons: list[float] = []
    for index, output in enumerate(usable):
        for other in usable[index + 1 :]:
            comparisons.append(_similarity(_normalize(output.content_summary), _normalize(other.content_summary)))
    score = sum(comparisons) / len(comparisons)
    if score < 0.45:
        unresolved.append("provider_output_divergence")
    dominant = sorted(usable, key=lambda item: item.confidence_score or 0, reverse=True)[0]
    return ProviderConsistencyResult(
        providers_compared=len(usable),
        consistency_score=round(score, 3),
        conflicts_detected=bool(unresolved),
        dominant_provider=dominant.provider_name,
        unresolved_conflicts=unresolved,
    )
