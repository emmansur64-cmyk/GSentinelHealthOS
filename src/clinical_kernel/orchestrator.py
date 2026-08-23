"""Deterministic Phase-0 planner owned by the ClinicalKernel boundary."""

from .canonical import canonical_sha256
from .contracts import ExecutionPlan, KernelRequest, PlannedEngine
from .registry import ENGINE_BY_CAPABILITY, ENGINE_BY_ID, validate_registry


class KernelOrchestrator:
    """Selects the minimum dependency-closed engine set for a typed request.

    It does not execute medicine in Phase 0. Engine selection is derived from
    governed capabilities and a versioned policy, never from an LLM response.
    """

    def __init__(self) -> None:
        validate_registry()

    def plan(self, request: KernelRequest) -> ExecutionPlan:
        selected: set[str] = set()

        def include(engine_id: str) -> None:
            if engine_id in selected:
                return
            manifest = ENGINE_BY_ID[engine_id]
            for dependency_id in manifest.dependencies:
                include(dependency_id)
            selected.add(engine_id)

        for capability in sorted(request.required_capabilities, key=str):
            include(ENGINE_BY_CAPABILITY[capability].engine_id)

        ordered = tuple(
            PlannedEngine(
                engine_id=manifest.engine_id,
                reason_code=(
                    "REQUESTED_CAPABILITY"
                    if manifest.capability in request.required_capabilities
                    else "REQUIRED_DEPENDENCY"
                ),
                dependency_ids=manifest.dependencies,
            )
            for manifest in ENGINE_BY_ID.values()
            if manifest.engine_id in selected
        )
        return ExecutionPlan(
            request_id=request.request_id,
            policy_version=request.policy_version,
            engine_sequence=ordered,
            plan_fingerprint=canonical_sha256({
                "schema_version": "execution-plan/v1",
                "request": request.canonical_record(),
                "engines": [
                    {
                        "engine_id": item.engine_id,
                        "reason_code": item.reason_code,
                        "dependency_ids": list(item.dependency_ids),
                    }
                    for item in ordered
                ],
            }),
            metadata={"authority": "CLINICAL_KERNEL", "planner": "DETERMINISTIC_V0"},
        )
