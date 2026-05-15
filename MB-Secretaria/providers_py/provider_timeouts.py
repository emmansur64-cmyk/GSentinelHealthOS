DEFAULT_PROVIDER_TIMEOUTS = {
    "text_ms": 5000,
    "image_ms": 8000,
    "multimodal_ms": 10000,
    "healthcheck_ms": 1500,
}


def resolve_provider_timeout(requested: int | None = None, modality: str = "text", request_type: str = "chat") -> int:
    if requested and requested > 0:
        return min(requested, 30000)
    if request_type == "healthcheck":
        return DEFAULT_PROVIDER_TIMEOUTS["healthcheck_ms"]
    if modality == "multimodal":
        return DEFAULT_PROVIDER_TIMEOUTS["multimodal_ms"]
    if modality == "image":
        return DEFAULT_PROVIDER_TIMEOUTS["image_ms"]
    return DEFAULT_PROVIDER_TIMEOUTS["text_ms"]
