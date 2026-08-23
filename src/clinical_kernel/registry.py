"""Closed Phase-0 registry for the eleven governed engines."""

from dataclasses import dataclass

from .contracts import Capability


@dataclass(frozen=True, slots=True)
class EngineManifest:
    engine_id: str
    capability: Capability
    dependencies: tuple[str, ...]
    authority_scope: str


ENGINE_MANIFESTS: tuple[EngineManifest, ...] = (
    EngineManifest("CRE", Capability.REASONING, (), "structured clinical hypotheses"),
    EngineManifest("CEE", Capability.EVIDENCE_EVALUATION, ("CRE",), "case evidence appraisal"),
    EngineManifest("CDR", Capability.DIAGNOSTIC_RANKING, ("CRE", "CEE"), "diagnostic ordering"),
    EngineManifest("CPIE", Capability.PATHOPHYSIOLOGY, ("CRE", "CDR"), "causal mechanisms"),
    EngineManifest("CCMP", Capability.COMPLICATIONS, ("CDR", "CPIE"), "complication assessment"),
    EngineManifest("CES", Capability.EVIDENCE_SYNTHESIS, ("CEE", "CDR"), "evidence synthesis"),
    EngineManifest("CCR", Capability.CONSTRAINTS, ("CDR", "CCMP"), "contraindications and constraints"),
    EngineManifest("CME", Capability.MANAGEMENT, ("CDR", "CCMP", "CCR", "CES"), "management candidates"),
    EngineManifest("CCFE", Capability.CONFIDENCE, ("CEE", "CDR", "CES"), "calibrated confidence"),
    EngineManifest("CUE", Capability.UNCERTAINTY, ("CDR", "CCFE"), "decision-changing uncertainty"),
    EngineManifest("CXE", Capability.EXPLAINABILITY, ("CME", "CUE"), "traceable explanation"),
)

ENGINE_BY_ID = {manifest.engine_id: manifest for manifest in ENGINE_MANIFESTS}
ENGINE_BY_CAPABILITY = {manifest.capability: manifest for manifest in ENGINE_MANIFESTS}


def validate_registry() -> None:
    if len(ENGINE_MANIFESTS) != 11:
        raise RuntimeError("the governed registry must contain exactly eleven engines")
    if len(ENGINE_BY_ID) != len(ENGINE_MANIFESTS):
        raise RuntimeError("engine identifiers must be unique")
    if len(ENGINE_BY_CAPABILITY) != len(ENGINE_MANIFESTS):
        raise RuntimeError("each capability must have exactly one owner")
    positions = {item.engine_id: index for index, item in enumerate(ENGINE_MANIFESTS)}
    for manifest in ENGINE_MANIFESTS:
        for dependency in manifest.dependencies:
            if dependency not in positions:
                raise RuntimeError(f"unknown dependency {dependency}")
            if positions[dependency] >= positions[manifest.engine_id]:
                raise RuntimeError("engine dependency graph must be acyclic")
