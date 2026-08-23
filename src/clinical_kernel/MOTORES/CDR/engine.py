from clinical_kernel.MOTORES.common import upstream_conclusions
from .contracts import CDRInput, CDROutput

class CDREngine:
    engine_id = "CDR"
    version = "cdr/v1"
    def run(self, value: CDRInput) -> CDROutput:
        return CDROutput(upstream_conclusions(value, engine_id=self.engine_id, version=self.version,
                                              conclusion_type="DIAGNOSTIC_RANK",
                                              statement_code="RANKED_GOVERNED_CANDIDATE"))
