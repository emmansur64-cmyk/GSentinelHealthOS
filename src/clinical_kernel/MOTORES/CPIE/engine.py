from clinical_kernel.MOTORES.common import rule_conclusions
from .contracts import CPIEInput, CPIEOutput

class CPIEEngine:
    engine_id = "CPIE"
    version = "cpie/v1"
    def run(self, value: CPIEInput) -> CPIEOutput:
        return CPIEOutput(rule_conclusions(value, engine_id=self.engine_id, version=self.version,
                                           conclusion_type="CAUSAL_MECHANISM"))
