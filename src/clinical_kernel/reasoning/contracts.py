"""The future CRE may consume only this typed, governed input."""

from dataclasses import dataclass

from clinical_kernel.evidence.contracts import EvidenceAssessment
from clinical_kernel.facts.contracts import ClinicalFactSet
from clinical_kernel.facts.temporal import FactTemporalState
from clinical_kernel.knowledge.contracts import ClinicalKnowledgeRule


@dataclass(frozen=True, slots=True)
class GovernedReasoningInput:
    fact_set: ClinicalFactSet
    temporal_state: FactTemporalState
    knowledge_release_id: str
    knowledge_rules: tuple[ClinicalKnowledgeRule, ...]
    evidence_assessments: tuple[EvidenceAssessment, ...] = ()

    def __post_init__(self) -> None:
        if self.fact_set.fact_set_hash != self.temporal_state.fact_set_hash:
            raise ValueError("reasoning facts and temporal projection do not match")
        if not self.knowledge_release_id.strip():
            raise ValueError("reasoning requires governed knowledge identity")
        accepted_rule_ids = {rule.rule_id for rule in self.knowledge_rules}
        if any(assessment.rule_id not in accepted_rule_ids for assessment in self.evidence_assessments):
            raise ValueError("evidence assessment is not linked to supplied governed knowledge")
