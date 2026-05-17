from uuid import uuid4


def create_trace_id(prefix: str = "trace") -> str:
    return f"{prefix}_{uuid4()}"


def create_correlation_id(prefix: str = "corr") -> str:
    return f"{prefix}_{uuid4()}"
