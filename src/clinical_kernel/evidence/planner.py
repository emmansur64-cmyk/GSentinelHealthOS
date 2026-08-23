"""Deterministic one-round evidence planning without patient identifiers."""

from hashlib import sha256

from clinical_kernel.contracts import Capability
from clinical_kernel.knowledge.contracts import ClinicalKnowledgeRule, KnowledgeVerificationStatus

from .contracts import EvidenceNeed, EvidenceNeedLevel


class EvidencePlanner:
    def plan_for_rules(
        self,
        *,
        capability: Capability,
        concept_ids: frozenset[str],
        candidate_rules: tuple[ClinicalKnowledgeRule, ...],
    ) -> tuple[EvidenceNeed, ...]:
        needs: list[EvidenceNeed] = []
        for rule in sorted(candidate_rules, key=lambda item: item.rule_id):
            if rule.verification_status is KnowledgeVerificationStatus.GOVERNANCE_ACCEPTED:
                continue
            matched = tuple(sorted(concept_ids.intersection(rule.concept_ids)))
            if not matched:
                continue
            seed = "|".join((capability.value, rule.rule_id, *matched))
            needs.append(
                EvidenceNeed(
                    need_id=f"evidence-need:{sha256(seed.encode('utf-8')).hexdigest()[:20]}",
                    capability=capability,
                    concept_ids=matched,
                    rule_ids=(rule.rule_id,),
                    level=EvidenceNeedLevel.BLOCKING,
                    reason_code="KNOWLEDGE_NOT_GOVERNANCE_ACCEPTED",
                )
            )
        return tuple(needs)
