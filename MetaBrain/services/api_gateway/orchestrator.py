from __future__ import annotations

from services.api_gateway.clients import ServiceClient
from services.shared.contracts import AnalyzeResponse, ModelInput, NLGOutput


async def run_distributed_orchestration(
    *,
    service_client: ServiceClient,
    model_input: ModelInput,
    patient_context: dict[str, object],
) -> AnalyzeResponse:
    model_output = await service_client.infer(model_input.model_dump())
    decision_output = await service_client.decide(model_output=model_output)

    fallback_used = False
    try:
        nlg_output_dict = await service_client.generate(
            decision_output=decision_output,
            model_output=model_output,
            patient_context=patient_context,
        )
        nlg_output = NLGOutput.model_validate(nlg_output_dict)
    except Exception:
        fallback_used = True
        nlg_output = NLGOutput(
            text=(
                f"Resultado estructurado: riesgo {decision_output['risk_level']}, "
                f"triage {decision_output['triage_level']}, "
                f"banda de confianza {decision_output['confidence_band']}."
            ),
            style="technical",
            variants_used=["safe_fallback"],
            disclaimers=["El servicio NLG no estuvo disponible; se entrega salida estructurada."],
        )

    return AnalyzeResponse(
        status="accepted",
        pipeline={
            "mode": "distributed",
            "steps": [
                "api-gateway",
                "inference-service",
                "decision-service",
                "nlg-service",
            ],
        },
        model_output=model_output,
        decision_output=decision_output,
        nlg_output=nlg_output,
        fallback_used=fallback_used,
    )
