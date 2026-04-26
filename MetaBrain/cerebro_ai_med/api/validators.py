from __future__ import annotations

import base64
import binascii
import re
from dataclasses import dataclass
from io import BytesIO
from typing import Any

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from cerebro_ai_med.api.runtime import load_runtime_settings
from cerebro_ai_med.api.schemas import AnalyzeInput, ImageFormInput, ImageInput, TextInput


MAX_IMAGE_DIMENSION = 8192
ALLOWED_IMAGE_TYPES = {"jpeg", "png", "bmp", "gif", "tiff"}
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


@dataclass(frozen=True)
class ImageMeta:
    image_format: str
    width: int
    height: int


def sanitize_text_input(raw_text: str) -> str:
    settings = load_runtime_settings()
    no_control = _CONTROL_CHARS_RE.sub(" ", raw_text)
    compact = " ".join(no_control.split()).strip()

    if not compact:
        raise HTTPException(status_code=422, detail="text_empty_after_sanitization")
    if settings.max_text_chars is not None and len(compact) > settings.max_text_chars:
        raise HTTPException(status_code=422, detail="text_too_large")
    return compact


def parse_json_input(body: Any) -> AnalyzeInput:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="json_must_be_object")

    input_type = str(body.get("input_type", "")).strip().lower()
    try:
        if input_type == "text":
            return TextInput.model_validate(body)
        if input_type == "image":
            return ImageInput.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    raise HTTPException(status_code=400, detail="input_type_must_be_text_or_image")


def parse_form_modality(raw_modality: Any) -> ImageFormInput:
    try:
        return ImageFormInput.model_validate({"modality": raw_modality or "XRAY"})
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


def decode_base64_image(raw_image: str) -> bytes:
    settings = load_runtime_settings()
    try:
        image_bytes = base64.b64decode(raw_image.strip(), validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="invalid_base64_image") from exc

    if not image_bytes:
        raise HTTPException(status_code=400, detail="empty_image")
    if len(image_bytes) > settings.max_image_bytes:
        raise HTTPException(status_code=400, detail="image_too_large")

    return image_bytes


def validate_image_bytes(image_bytes: bytes) -> ImageMeta:
    settings = load_runtime_settings()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="empty_image")
    if len(image_bytes) > settings.max_image_bytes:
        raise HTTPException(status_code=400, detail="image_too_large")

    try:
        with Image.open(BytesIO(image_bytes)) as img:
            img.verify()

        with Image.open(BytesIO(image_bytes)) as img_verified:
            image_format = (img_verified.format or "").lower()
            width, height = img_verified.size
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="unsupported_image_format") from exc

    if image_format not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="unsupported_image_format")
    if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
        raise HTTPException(status_code=422, detail="image_dimensions_out_of_range")

    return ImageMeta(image_format=image_format, width=width, height=height)