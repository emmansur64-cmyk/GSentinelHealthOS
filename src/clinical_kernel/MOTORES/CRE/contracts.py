from dataclasses import dataclass
from clinical_kernel.contracts import Capability
from clinical_kernel.MOTORES.common import EngineInput, EngineResult, validate_engine_input

@dataclass(frozen=True, slots=True)
class CREInput(EngineInput):
    def __post_init__(self) -> None:
        EngineInput.__post_init__(self)
        validate_engine_input(self, capability=Capability.REASONING, allowed_upstream=frozenset())

@dataclass(frozen=True, slots=True)
class CREOutput:
    result: EngineResult
    def __post_init__(self) -> None:
        if self.result.engine_id != "CRE": raise ValueError("CRE output requires a CRE result")
