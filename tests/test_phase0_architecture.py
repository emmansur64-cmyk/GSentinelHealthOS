from clinical_kernel.contracts import Capability, CaseEnvelope, KernelRequest, RequestKind
from clinical_kernel.orchestrator import KernelOrchestrator
from clinical_kernel.registry import ENGINE_MANIFESTS, validate_registry


def _request(*capabilities: Capability) -> KernelRequest:
    return KernelRequest(
        request_id="req-001",
        kind=RequestKind.PATIENT_CASE,
        case=CaseEnvelope(
            case_id="case-001",
            revision=1,
            fact_set_hash="facts-sha256",
            knowledge_release_id="knowledge-v1",
            terminology_release_id="terminology-v1",
        ),
        required_capabilities=frozenset(capabilities),
        policy_version="policy-v0",
    )


def test_registry_has_exactly_eleven_unique_acyclic_engines() -> None:
    validate_registry()
    assert len(ENGINE_MANIFESTS) == 11
    assert len({item.capability for item in ENGINE_MANIFESTS}) == 11


def test_orchestrator_selects_dependency_closed_minimum_plan() -> None:
    plan = KernelOrchestrator().plan(_request(Capability.DIAGNOSTIC_RANKING))
    assert [item.engine_id for item in plan.engine_sequence] == ["CRE", "CEE", "CDR"]
    assert [item.reason_code for item in plan.engine_sequence] == [
        "REQUIRED_DEPENDENCY",
        "REQUIRED_DEPENDENCY",
        "REQUESTED_CAPABILITY",
    ]


def test_same_governed_input_produces_same_fingerprint() -> None:
    orchestrator = KernelOrchestrator()
    request = _request(Capability.EXPLAINABILITY)
    assert orchestrator.plan(request).plan_fingerprint == orchestrator.plan(request).plan_fingerprint


def test_plan_is_owned_by_kernel_authority() -> None:
    plan = KernelOrchestrator().plan(_request(Capability.UNCERTAINTY))
    assert plan.metadata["authority"] == "CLINICAL_KERNEL"
