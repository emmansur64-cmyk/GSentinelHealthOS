from __future__ import annotations

from datetime import datetime, timezone

from .audit import build_image_audit_ref
from .confidence import calculate_metadata_only_confidence
from .ingestion import ingest_image_input
from .metadata_extractor import extract_image_metadata
from .modality_router import route_image_modality
from .normalizer import normalize_image_input
from .types import ImageAnalysisResult, ImageInput


class LegacyImageAdapter:
    legacy_metadata_only = True
    no_visual_diagnosis = True
    no_definitive_diagnosis = True

    def analyze(self, input_data: ImageInput) -> ImageAnalysisResult:
        ingestion = ingest_image_input(input_data)
        if not ingestion.get("accepted"):
            return ImageAnalysisResult(
                trace_id=input_data.trace_id,
                status="metadata_only",
                modality="UNKNOWN",
                findings=["Image input was rejected before analysis. No visual diagnosis was performed."],
                risk_level="unknown",
                confidence_score=0.0,
                uncertainty_score=1.0,
                requires_human_review=True,
                human_review_reason=str(ingestion.get("rejection_reason") or "image_ingestion_rejected"),
                provider="legacy_metadata_adapter",
                model_version="metadata_only_v1",
                no_definitive_diagnosis=True,
                safety_notes=list(ingestion.get("safety_notes", [])),
                audit_ref=build_image_audit_ref(input_data),
                created_at=datetime.now(timezone.utc).isoformat(),
            )

        normalized_info = normalize_image_input(input_data)
        normalized = normalized_info["input"]
        metadata = extract_image_metadata(normalized)
        route = route_image_modality(metadata)
        confidence = calculate_metadata_only_confidence(metadata)

        return ImageAnalysisResult(
            trace_id=normalized.trace_id,
            status="metadata_only",
            modality=route["modality"],
            findings=[
                "Legacy metadata-only image context prepared.",
                f"Quality flags: {', '.join(metadata.image_quality_flags) if metadata.image_quality_flags else 'none'}.",
            ],
            risk_level=confidence["risk_level"],
            confidence_score=confidence["confidence_score"],
            uncertainty_score=confidence["uncertainty_score"],
            requires_human_review=True,
            human_review_reason=route["route_reason"],
            provider="legacy_metadata_adapter",
            model_version="metadata_only_v1",
            no_definitive_diagnosis=True,
            safety_notes=[
                "No definitive diagnosis.",
                "Metadata-only analysis.",
                "Human review required for medical interpretation.",
                "legacy_metadata_only=true",
                "no_visual_diagnosis=true",
                "requires_human_review=true",
            ],
            audit_ref=build_image_audit_ref(normalized),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
