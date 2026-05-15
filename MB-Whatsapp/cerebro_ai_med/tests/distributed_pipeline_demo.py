from __future__ import annotations

from services.decision_service.main import decide
from services.inference_service.main import infer
from services.nlg_service.main import generate
from services.shared.contracts import DecisionInput, ModelInput, NLGInput


def run_distributed_demo() -> None:
    model_input = ModelInput(
        source_type="text",
        modality="TEXT",
        text="Paciente con disnea, dolor toracico y fiebre alta",
    )

    model_output = infer(model_input)
    decision_output = decide(
        DecisionInput(
            model_output=model_output,
            patient_context={"age": 73, "symptoms": ["fiebre", "disnea", "dolor_toracico"]},
        )
    )
    nlg_output = generate(
        NLGInput(
            decision_output=decision_output,
            model_output=model_output,
            patient_context={"age": 73, "symptoms": ["fiebre", "disnea", "dolor_toracico"]},
        )
    )

    print("MODEL:", model_output.model_dump())
    print("DECISION:", decision_output.model_dump())
    print("NLG:", nlg_output.model_dump())


if __name__ == "__main__":
    run_distributed_demo()
