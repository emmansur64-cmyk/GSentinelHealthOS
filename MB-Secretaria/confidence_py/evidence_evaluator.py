from .types import ClinicalConfidenceInput, EvidenceEvaluation, LayerSummary


def _score_layer(layer: LayerSummary | None) -> float:
    if layer is None or not layer.available:
        return 0.0
    return max(0.0, min(1.0, layer.quality_score if layer.quality_score is not None else 0.6))


def evaluate_evidence(item: ClinicalConfidenceInput) -> EvidenceEvaluation:
    missing: list[str] = []
    conflicts: list[str] = []
    image_needed = item.modality in {"image", "multimodal"}

    layers = [
        ("retrieval_unavailable", item.retrieval_summary),
        ("memory_context_unavailable", item.memory_context_summary),
        ("risk_summary_unavailable", item.risk_summary),
    ]
    if image_needed:
        layers.append(("image_summary_unavailable", item.image_summary))

    for missing_name, layer in layers:
        if layer is None or not layer.available:
            missing.append(missing_name)
        conflicts.extend(layer.conflicts if layer else [])

    retrieval = _score_layer(item.retrieval_summary)
    memory = _score_layer(item.memory_context_summary)
    risk = _score_layer(item.risk_summary)
    image = _score_layer(item.image_summary) if image_needed else 1.0

    return EvidenceEvaluation(
        evidence_completeness=round((retrieval + memory + risk + image) / 4, 3),
        missing_evidence=missing,
        conflict_signals=conflicts,
    )
