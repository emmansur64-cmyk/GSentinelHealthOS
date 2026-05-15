"""Controlled non-diagnostic image intelligence boundary for MetaBrain."""

from .audit import build_image_audit_event, build_image_audit_ref
from .confidence import calculate_metadata_only_confidence
from .feature_flags import load_image_feature_flags
from .legacy_adapter import LegacyImageAdapter
from .metadata_extractor import extract_image_metadata, sanitize_image_metadata
from .modality_router import route_image_modality
from .normalizer import normalize_image_input
from .types import (
    ImageAnalysisResult,
    ImageAuditEvent,
    ImageFeatureFlags,
    ImageInput,
    ImageMetadata,
)

__all__ = [
    "ImageAnalysisResult",
    "ImageAuditEvent",
    "ImageFeatureFlags",
    "ImageInput",
    "ImageMetadata",
    "LegacyImageAdapter",
    "build_image_audit_event",
    "build_image_audit_ref",
    "calculate_metadata_only_confidence",
    "extract_image_metadata",
    "load_image_feature_flags",
    "normalize_image_input",
    "route_image_modality",
    "sanitize_image_metadata",
]
