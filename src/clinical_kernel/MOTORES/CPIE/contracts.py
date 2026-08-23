from dataclasses import dataclass
from clinical_kernel.contracts import Capability
from clinical_kernel.MOTORES.common import EngineInput, EngineResult, validate_engine_input

@dataclass(frozen=True, slots=True)
class CPIEInput(EngineInput):
    def __post_init__(self) -> None:
        EngineInput.__post_init__(self)
        validate_engine_input(self, capability=Capability.PATHOPHYSIOLOGY, allowed_upstream=frozenset({"CRE", "CDR"}))

@dataclass(frozen=True, slots=True)
class CPIEOutput:
    result: EngineResult
    def __post_init__(self) -> None:
        if self.result.engine_id != "CPIE": raise ValueError("CPIE output requires a CPIE result")
