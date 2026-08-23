from clinical_kernel.MOTORES.common import rule_conclusions
from .contracts import CREInput, CREOutput

class CREEngine:
    engine_id = "CRE"
    version = "cre/v1"
    def run(self, value: CREInput) -> CREOutput:
        return CREOutput(rule_conclusions(value, engine_id=self.engine_id, version=self.version,
                                          conclusion_type="STRUCTURED_HYPOTHESIS"))
