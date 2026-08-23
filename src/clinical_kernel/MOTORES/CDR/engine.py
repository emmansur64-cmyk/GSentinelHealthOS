from clinical_kernel.contracts import Capability
from clinical_kernel.MOTORES.common import ClinicalEngine, EngineResult, upstream_conclusions

from .contracts import CDRInput


class CDREngine:
    engine_id = "CDR"
    version = "cdr/v1"
    capability = Capability.DIAGNOSTIC_RANKING
    def run(self, value: CDRInput) -> EngineResult:
        return upstream_conclusions(
            value, engine_id=self.engine_id, version=self.version, capability=self.capability,
            conclusion_type="DIAGNOSTIC_RANK", statement_code="RANKED_GOVERNED_CANDIDATE",
        )


_contract_check: ClinicalEngine[CDRInput] = CDREngine()
