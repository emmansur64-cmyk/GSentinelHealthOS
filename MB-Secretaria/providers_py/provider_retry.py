from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class ProviderRetryPolicy:
    max_attempts: int = 1
    base_delay_ms: int = 250


def with_provider_retry(operation: Callable[[int], T], policy: ProviderRetryPolicy = ProviderRetryPolicy()) -> tuple[T, int]:
    last_error: Exception | None = None
    for attempt in range(1, max(1, policy.max_attempts) + 1):
        try:
            return operation(attempt), attempt - 1
        except Exception as exc:
            last_error = exc
    assert last_error is not None
    raise last_error
