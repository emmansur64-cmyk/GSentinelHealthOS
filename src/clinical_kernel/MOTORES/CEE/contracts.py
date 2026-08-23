from dataclasses import dataclass
from clinical_kernel.contracts import Capability
from clinical_kernel.MOTORES.common import EngineInput, EngineResult, validate_engine_input

@dataclass(frozen=True, slots=True)
class CEEInput(EngineInput):
    def __post_init__(self) -> None:
        EngineInput.__post_init__(self)
        validate_engine_input(self, capability=Capability.EVIDENCE_EVALUATION, allowed_upstream=frozenset({"CRE"}))

@dataclass(frozen=True, slots=True)
class CEEOutput:
    result: EngineResult
    def __post_init__(self) -> None:
        if self.result.engine_id != "CEE": raise ValueError("CEE output requires a CEE result")
