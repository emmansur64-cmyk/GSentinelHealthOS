"""Orchestration engine: planner + generator."""

from __future__ import annotations

import logging

from services.nlg_service.app.generator import NLGGenerator, GeneratedMessage
from services.nlg_service.app.planner import MessagePlanner
from services.nlg_service.app.reformulator import MetaReformulator
from services.shared.contracts import DecisionOutput, ModelOutput


logger = logging.getLogger(__name__)


class NLGEngineError(Exception):
    """Custom exception for NLG errors."""
    
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NLGEngine:
    """
    Orquestador NLG: combina planner + generator.
    
    Flujo:
    1. Planner: Decide estructura del mensaje (sin generar texto)
    2. Generator: Construye texto final basado en plan
    """

    def __init__(self) -> None:
        self._planner = MessagePlanner()
        self._generator = NLGGenerator()
        self._reformulator = MetaReformulator()

    def llm_status(self) -> dict[str, object]:
        """Expose reformulation backend status for internal diagnostics."""
        return self._reformulator.diagnostic_status()

    def generate(
        self,
        decision_output: DecisionOutput,
        model_output: ModelOutput,
        dialogue_intent: str = "default",
        symptoms: list[str] | None = None,
        patient_context: dict[str, object] | None = None,
    ) -> dict[str, object]:
        """
        Generar mensaje natural completo.
        
        Args:
            decision_output: Salida de decision-service
            model_output: Salida de inference-service
            dialogue_intent: Intención conversacional (symptom_report, severity_question, etc)
            symptoms: Síntomas reportados
            patient_context: Contexto adicional del paciente
            
        Returns:
            Dict con campos: message, style, variants_used, disclaimers
            
        Raises:
            NLGEngineError: Si hay error en generación
        """
        try:
            # Validación básica
            if not decision_output:
                raise ValueError("decision_output es requerido")
            if not model_output:
                raise ValueError("model_output es requerido")
            
            # Planificar estructura
            logger.info(
                "planning_message",
                extra={
                    "risk_level": decision_output.risk_level,
                    "intent": dialogue_intent,
                    "symptom_count": len(symptoms) if symptoms else 0,
                }
            )

            full_history = self._extract_full_history(patient_context or {})
            turn_index = self._safe_turn_index(patient_context or {}, len(full_history))
            
            plan = self._planner.plan(
                decision_output=decision_output,
                dialogue_intent=dialogue_intent,
                patient_symptoms=symptoms or [],
                turn_index=turn_index,
                history_size=len(full_history),
            )
            
            # Generar texto
            logger.info(
                "generating_message",
                extra={
                    "structure": plan.structure,
                    "tone": plan.tone,
                }
            )
            
            generated: GeneratedMessage = self._generator.generate(
                plan=plan,
                decision_output=decision_output,
                model_output=model_output,
                symptoms=symptoms or [],
                history_context={
                    "history_size": len(full_history),
                    "turn_index": turn_index,
                },
            )

            reformulation = self._reformulator.reformulate(
                generated.text,
                style_stage=plan.style_stage,
                turn_index=turn_index,
                history_size=len(full_history),
                component_slots=plan.component_slots,
            )
            final_text = reformulation.text
            
            # Extraer disclaimers del texto
            disclaimers = self._extract_disclaimers(generated.sections)
            for extra_disclaimer in reformulation.disclaimers:
                if extra_disclaimer not in disclaimers:
                    disclaimers.append(extra_disclaimer)

            variants_used = list(generated.variants_used)
            variants_used.extend(reformulation.variants_used)
            variants_used.append(f"meta_stage:{plan.style_stage}")
            variants_used.append(f"meta_turn:{turn_index}")
            variants_used.append(f"meta_history_size:{len(full_history)}")
            for key, value in plan.component_slots.items():
                variants_used.append(f"component:{key}:{value}")

            metadata = {
                "meta_stage": plan.style_stage,
                "meta_turn": turn_index,
                "meta_history_size": len(full_history),
                "llm_pipeline": reformulation.metadata.get("llm_pipeline")
                if isinstance(reformulation.metadata, dict)
                else None,
            }
            
            logger.info(
                "message_generated_success",
                extra={
                    "length": len(final_text),
                    "variants_count": len(variants_used),
                    "sections_generated": list(generated.sections.keys()),
                    "meta_style_stage": plan.style_stage,
                    "meta_turn_index": turn_index,
                    "meta_history_size": len(full_history),
                }
            )
            
            return {
                "message": final_text,
                "style": "clinical",
                "variants_used": variants_used,
                "disclaimers": disclaimers,
                "metadata": metadata,
            }
            
        except ValueError as e:
            logger.warning(
                "validation_error",
                extra={"error": str(e)}
            )
            raise NLGEngineError(
                code="validation_error",
                message=str(e),
                status_code=422,
            )
        except Exception as e:
            logger.error(
                "generation_failed",
                extra={"error": str(e), "error_type": type(e).__name__}
            )
            raise NLGEngineError(
                code="generation_failed",
                message="Error al generar mensaje natural",
                status_code=500,
            )

    def _extract_disclaimers(self, sections: dict[str, str]) -> list[str]:
        """Extraer disclaimers del texto generado."""
        disclaimers: list[str] = []
        
        if "disclaimer" in sections:
            disclaimers.append(sections["disclaimer"])
        
        # Agregar disclaimers adicionales si es alto riesgo
        # (implícito en la generación, pero explicitamos aquí)
        disclaimers.append("medical_professional_review_recommended")
        
        return disclaimers

    def _extract_full_history(self, patient_context: dict[str, object]) -> list[dict[str, object]]:
        candidates = [
            patient_context.get("conversation_history"),
            patient_context.get("history"),
            patient_context.get("message_history"),
            patient_context.get("full_history"),
        ]

        history: list[dict[str, object]] = []
        for candidate in candidates:
            if isinstance(candidate, list):
                for item in candidate:
                    if isinstance(item, dict):
                        history.append(item)
                    elif isinstance(item, str):
                        history.append({"role": "user", "text": item})

        return history

    def _safe_turn_index(self, patient_context: dict[str, object], history_size: int) -> int:
        raw = patient_context.get("turn_index")
        if isinstance(raw, int) and raw > 0:
            return raw
        return max(1, history_size + 1)
