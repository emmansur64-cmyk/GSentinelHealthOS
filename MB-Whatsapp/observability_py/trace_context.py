from datetime import UTC, datetime

from .correlation import create_correlation_id, create_trace_id
from .types import TraceContext


def create_trace_context(
    tenant_id: str,
    request_type: str,
    source_layer: str,
    parent_trace_id: str | None = None,
    trace_id: str | None = None,
    correlation_id: str | None = None,
) -> TraceContext:
    return TraceContext(
        trace_id=trace_id or create_trace_id(),
        correlation_id=correlation_id or create_correlation_id(),
        parent_trace_id=parent_trace_id,
        tenant_id=tenant_id,
        request_type=request_type,
        source_layer=source_layer,
        created_at=datetime.now(UTC).isoformat(),
    )
