"""Explicit revision delta application; absence never means retraction."""

from dataclasses import dataclass

from clinical_kernel.errors import ClinicalKernelError, KernelErrorCode, KernelErrorDetail

from .contracts import ClinicalFact, ClinicalFactSet


@dataclass(frozen=True, slots=True)
class ClinicalFactDelta:
    base_revision: int
    target_revision: int
    additions: tuple[ClinicalFact, ...] = ()
    replacements: tuple[ClinicalFact, ...] = ()
    retracted_fact_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.target_revision != self.base_revision + 1:
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.REVISION_GAP, "a delta must advance exactly one revision")
            )
        changed = [fact.fact_id for fact in (*self.additions, *self.replacements)]
        if len(changed) != len(set(changed)) or set(changed) & set(self.retracted_fact_ids):
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "a delta cannot change one fact twice")
            )


def apply_delta(previous: ClinicalFactSet, delta: ClinicalFactDelta) -> ClinicalFactSet:
    by_id = {fact.fact_id: fact for fact in previous.facts}
    missing_retractions = set(delta.retracted_fact_ids) - set(by_id)
    missing_replacements = {fact.fact_id for fact in delta.replacements} - set(by_id)
    duplicate_additions = {fact.fact_id for fact in delta.additions} & set(by_id)
    if missing_retractions or missing_replacements or duplicate_additions:
        raise ClinicalKernelError(
            KernelErrorDetail(KernelErrorCode.REVISION_CONFLICT, "delta does not match its base fact set")
        )
    for fact_id in delta.retracted_fact_ids:
        del by_id[fact_id]
    for fact in delta.replacements:
        by_id[fact.fact_id] = fact
    for fact in delta.additions:
        by_id[fact.fact_id] = fact
    return ClinicalFactSet.build(subject_id=previous.subject_id, facts=tuple(by_id.values()))
