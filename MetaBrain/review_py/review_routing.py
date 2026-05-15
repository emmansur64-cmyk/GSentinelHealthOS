from .types import ClinicalReviewCase


def route_review_case(review_case: ClinicalReviewCase) -> dict[str, str]:
    if review_case.status == "REQUIRES_SPECIALIST" or review_case.escalation_level == "specialist":
        return {"queue": "specialist_review"}
    if review_case.escalation_level == "urgent" or review_case.risk_level == "critical":
        return {"queue": "urgent_clinical_review"}
    if review_case.modality in {"image", "multimodal"}:
        return {"queue": "multimodal_review"}
    return {"queue": "clinical_review"}
