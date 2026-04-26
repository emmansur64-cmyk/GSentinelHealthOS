from __future__ import annotations


class SlotBookingPolicy:
    """Domain-level business validations for slot booking workflows."""

    @staticmethod
    def validate_priority(priority: str) -> None:
        if priority not in {"normal", "urgent"}:
            raise ValueError("Invalid priority. Use 'normal' or 'urgent'")

    @staticmethod
    def validate_positive_id(value: int, field_name: str) -> None:
        if value <= 0:
            raise ValueError(f"{field_name} must be greater than zero")

    @staticmethod
    def validate_book_next_rules(priority: str, allow_reassign: bool) -> None:
        SlotBookingPolicy.validate_priority(priority)
        if priority == "normal" and allow_reassign:
            raise ValueError("allow_reassign is only valid for urgent priority")

    @staticmethod
    def validate_days_window(days: int, min_days: int = 1, max_days: int = 365) -> None:
        if days < min_days or days > max_days:
            raise ValueError(f"days must be between {min_days} and {max_days}")
