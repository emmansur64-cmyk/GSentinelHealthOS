from __future__ import annotations

import re
from dataclasses import replace
from typing import Any

from .types import ImageInput


def normalize_image_input(input_data: ImageInput) -> dict[str, Any]:
    normalized_filename = None
    if input_data.filename:
        normalized_filename = re.sub(r"[^\w.\- ]", "", input_data.filename).strip() or None

    normalized = replace(
        input_data,
        mime_type=input_data.mime_type.strip().lower(),
        filename=normalized_filename,
    )
    return {
        "input": normalized,
        "normalized_mime_type": normalized.mime_type,
        "normalized_filename": normalized_filename,
        "original_payload_present": bool(normalized.image_base64 or normalized.raw_bytes),
    }
