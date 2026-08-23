from clinical_kernel.MOTORES.common import evidence_conclusions
from .contracts import CEEInput, CEEOutput

class CEEEngine:
    engine_id = "CEE"
    version = "cee/v1"
    def run(self, value: CEEInput) -> CEEOutput:
        return CEEOutput(evidence_conclusions(value, engine_id=self.engine_id, version=self.version,
                                              conclusion_type="EVIDENCE_APPRAISAL"))
