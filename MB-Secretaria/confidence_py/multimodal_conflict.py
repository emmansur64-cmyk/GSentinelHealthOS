from .types import ClinicalConfidenceInput, MultimodalConflictResult


def detect_multimodal_conflict(item: ClinicalConfidenceInput) -> MultimodalConflictResult:
    conflicts: list[str] = []
    if item.modality == "text":
        return MultimodalConflictResult(False, conflicts)
    if item.image_summary:
        conflicts.extend([f"image:{value}" for value in item.image_summary.conflicts])
    conflicts.extend([f"retrieval:{value}" for value in item.retrieval_summary.conflicts])
    conflicts.extend([f"memory:{value}" for value in item.memory_context_summary.conflicts])
    if item.modality == "multimodal" and not (item.image_summary and item.image_summary.available):
        conflicts.append("multimodal_image_evidence_missing")
    return MultimodalConflictResult(bool(conflicts), conflicts)
