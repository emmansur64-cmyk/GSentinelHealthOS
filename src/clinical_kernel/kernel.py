"""Sole public authority boundary for governed clinical processing."""

from dataclasses import dataclass

from .contracts import ExecutionPlan, KernelRequest, RequestKind
from .facts.intake import AcceptedClinicalIntake, ClinicalIntakeService, StructuredCaseInput
from .facts.terminology import GovernedTerminologyRegistry
from .facts.units import GovernedUnitRegistry
from .canonical import canonical_sha256
from .orchestrator import KernelOrchestrator
from .policy import DEFAULT_PHASE1_POLICY, KernelPolicy
from .knowledge.store import KnowledgeStore
from .errors import ClinicalKernelError, KernelErrorCode, KernelErrorDetail
from .state import CaseScope, ClinicalStateStore, IdempotencyRecord, InMemoryClinicalStateStore, StoredCaseRevision


@dataclass(frozen=True, slots=True)
class PreparedKernelExecution:
    intake: AcceptedClinicalIntake
    plan: ExecutionPlan


class ClinicalKernel:
    """Owns intake, policy and orchestration; engines arrive in later phases."""

    def __init__(
        self,
        *,
        terminology: GovernedTerminologyRegistry,
        knowledge_store: KnowledgeStore,
        units: GovernedUnitRegistry | None = None,
        policy: KernelPolicy = DEFAULT_PHASE1_POLICY,
        state_store: ClinicalStateStore | None = None,
    ) -> None:
        self._policy = policy
        self._knowledge = knowledge_store
        self._intake = ClinicalIntakeService(terminology, units)
        self._orchestrator = KernelOrchestrator()
        self._state = state_store or InMemoryClinicalStateStore()

    def prepare(
        self,
        *,
        request_id: str,
        kind: RequestKind,
        incoming: StructuredCaseInput,
        scope: CaseScope,
    ) -> PreparedKernelExecution:
        if scope.case_id != incoming.case_id:
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "scope and input case_id must match")
            )
        try:
            active_knowledge = self._knowledge.active()
            intake = self._intake.accept(
                incoming,
                knowledge_release_id=active_knowledge.release_id,
            )
        except ClinicalKernelError:
            raise
        except (TypeError, ValueError) as exc:
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.INVALID_INPUT, str(exc))
            ) from exc
        input_fingerprint = canonical_sha256({
            "schema_version": "kernel-input-fingerprint/v1",
            "scope": {
                "tenant_id": scope.tenant_id,
                "clinician_id": scope.clinician_id,
                "conversation_id": scope.conversation_id,
                "case_id": scope.case_id,
            },
            "revision": incoming.revision,
            "fact_set_hash": intake.fact_set.fact_set_hash,
            "knowledge_release_id": active_knowledge.release_id,
            "terminology_release_id": intake.terminology_release_id,
            "request_kind": kind.value,
        })
        prior_request = self._state.idempotency(request_id)
        if prior_request is not None and prior_request.input_fingerprint != input_fingerprint:
            raise ClinicalKernelError(
                KernelErrorDetail(
                    KernelErrorCode.IDEMPOTENCY_CONFLICT,
                    "request_id was already used for different clinical input",
                )
            )
        latest = self._state.latest(scope)
        if prior_request is None and latest is None and incoming.revision != 1:
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.REVISION_GAP, "the first case revision must be 1")
            )
        if prior_request is None and latest is not None:
            same_revision_changed = (
                intake.fact_set.fact_set_hash != latest.fact_set.fact_set_hash
                or active_knowledge.release_id != latest.knowledge_release_id
                or intake.terminology_release_id != latest.terminology_release_id
            )
            if incoming.revision == latest.revision and same_revision_changed:
                raise ClinicalKernelError(
                    KernelErrorDetail(KernelErrorCode.REVISION_CONFLICT, "revision content is immutable")
                )
            if incoming.revision < latest.revision or incoming.revision > latest.revision + 1:
                raise ClinicalKernelError(
                    KernelErrorDetail(KernelErrorCode.REVISION_GAP, "revision must replay current or advance by one")
                )
            if (
                incoming.revision == latest.revision + 1
                and not same_revision_changed
            ):
                raise ClinicalKernelError(
                    KernelErrorDetail(KernelErrorCode.REVISION_CONFLICT, "a new revision must change governed state")
                )
        request = KernelRequest(
            request_id=request_id,
            kind=kind,
            case=intake.case,
            required_capabilities=self._policy.capabilities_for(kind),
            policy_version=self._policy.version,
        )
        prepared = PreparedKernelExecution(
            intake=intake,
            plan=self._orchestrator.plan(request),
        )
        if prior_request is not None and prior_request.plan_fingerprint != prepared.plan.plan_fingerprint:
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.IDEMPOTENCY_CONFLICT, "idempotent plan changed")
            )
        if prior_request is not None:
            return prepared
        self._state.commit(
            StoredCaseRevision(
                scope,
                incoming.revision,
                intake.fact_set,
                active_knowledge.release_id,
                intake.terminology_release_id,
            ),
            IdempotencyRecord(request_id, input_fingerprint, prepared.plan.plan_fingerprint),
        )
        return prepared
