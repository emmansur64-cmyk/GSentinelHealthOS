from dataclasses import dataclass
from clinical_kernel.contracts import Capability
from clinical_kernel.MOTORES.common import EngineInput, EngineResult, validate_engine_input

@dataclass(frozen=True, slots=True)
class CDRInput(EngineInput):
    def __post_init__(self) -> None:
        EngineInput.__post_init__(self)
        validate_engine_input(self, capability=Capability.DIAGNOSTIC_RANKING, allowed_upstream=frozenset({"CRE", "CEE"}))

@dataclass(frozen=True, slots=True)
class CDROutput:
    result: EngineResult
    def __post_init__(self) -> None:
        if self.result.engine_id != "CDR": raise ValueError("CDR output requires a CDR result")
