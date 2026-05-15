from .types import ReviewStatus

REVIEW_STATUSES: tuple[ReviewStatus, ...] = (
    "PENDING_REVIEW",
    "UNDER_REVIEW",
    "ESCALATED",
    "APPROVED",
    "REJECTED",
    "OVERRIDDEN",
    "AUTO_BLOCKED",
    "REQUIRES_SPECIALIST",
    "CLOSED",
)


def is_terminal_review_status(status: ReviewStatus) -> bool:
    return status in {"APPROVED", "REJECTED", "OVERRIDDEN", "CLOSED"}
