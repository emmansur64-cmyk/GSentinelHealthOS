# MetaBrain Image Intelligence Layer

Phase 4 creates a controlled, non-diagnostic image pipeline boundary without replacing the current metadata-based image flow.

## Status

- Runtime connected: no
- Default enabled: no
- Active pipeline: legacy metadata-only
- Visual provider: contract only
- DICOM: contract and defensive detection only
- Observable behavior change: none intended

## Responsibilities

- Ingest image inputs with trace and tenant/doctor scope.
- Normalize MIME/filename metadata without storing original images.
- Extract safe metadata such as dimensions, aspect ratio and bytes-per-pixel.
- Route modality defensively.
- Produce confidence and uncertainty scores that reflect metadata-only limits.
- Require human review for medically sensitive image interpretation.
- Emit audit event shapes without PHI-heavy payloads.
- Prepare future provider and DICOM contracts behind flags.

## Feature Flags

These flags are documented only. No `.env` files were modified.

- `MEDICAL_VISION_ENABLED=false`
- `MEDICAL_VISION_SHADOW_MODE=true`
- `MEDICAL_VISION_PROVIDER_ENABLED=false`
- `DICOM_ENABLED=false`
- `DICOM_SHADOW_MODE=true`
- `IMAGE_HUMAN_REVIEW_REQUIRED=true`
- `IMAGE_STORE_ORIGINAL=false`

## Clinical Safety

The Phase 4 layer does not diagnose, does not interpret lesions or organs, does not call external image providers and does not store original clinical images by default.
