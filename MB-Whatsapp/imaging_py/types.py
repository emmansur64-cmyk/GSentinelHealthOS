from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional


ImageModality = Literal["TEXT", "XRAY", "CT", "MRI", "DICOM", "PNG", "JPG", "JPEG", "UNKNOWN"]
ImageRiskLevel = Literal["low", "medium", "high", "unknown"]
ImageAnalysisStatus = Literal["skipped", "metadata_only", "provider_disabled", "fallback", "completed"]


@dataclass
class ImageInput:
    trace_id: str
    tenant_id: str
    doctor_id: str
    source: str
    mime_type: str
    bytes_size: int
    metadata: dict[str, Any] = field(default_factory=dict)
    patient_id: Optional[str] = None
    filename: Optional[str] = None
    image_base64: Optional[str] = None
    raw_bytes: Optional[bytes] = None


@dataclass
class ImageMetadata:
    mime_type: str
    dicom_detected: bool
    image_quality_flags: list[str]
    sanitized_metadata: dict[str, Any]
    width: Optional[int] = None
    height: Optional[int] = None
    aspect_ratio: Optional[float] = None
    pixels_million: Optional[float] = None
    bytes_per_pixel: Optional[float] = None
    modality: Optional[ImageModality] = None


@dataclass
class ImageAnalysisResult:
    trace_id: str
    status: ImageAnalysisStatus
    modality: ImageModality
    findings: list[str]
    risk_level: ImageRiskLevel
    confidence_score: float
    uncertainty_score: float
    requires_human_review: bool
    human_review_reason: str
    provider: str
    model_version: str
    no_definitive_diagnosis: bool
    safety_notes: list[str]
    audit_ref: str
    created_at: str


@dataclass(frozen=True)
class ImageAuditEvent:
    trace_id: str
    tenant_id: str
    doctor_id: str
    source: str
    modality: ImageModality
    provider: str
    confidence_score: float
    uncertainty_score: float
    requires_human_review: bool
    no_definitive_diagnosis: bool
    created_at: str
    patient_id: Optional[str] = None


@dataclass(frozen=True)
class ImageFeatureFlags:
    medical_vision_enabled: bool = False
    medical_vision_shadow_mode: bool = True
    medical_vision_provider_enabled: bool = False
    dicom_enabled: bool = False
    dicom_shadow_mode: bool = True
    image_human_review_required: bool = True
    image_store_original: bool = False
