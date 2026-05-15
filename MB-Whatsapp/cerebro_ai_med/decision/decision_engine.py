from __future__ import annotations

import math
from dataclasses import dataclass, asdict
from typing import Any

# ---------------------------------------------------------------------------
# Prioridad de reglas — menor número = mayor prioridad clínica
# ---------------------------------------------------------------------------
RULE_PRIORITIES: dict[str, int] = {
    "possible_pneumonia": 1,
    "possible_fracture": 2,
    "normal": 10,
}

# ---------------------------------------------------------------------------
# Umbrales para política NO_RESPOND y bandas de confianza
# ---------------------------------------------------------------------------
NO_RESPOND_CONFIDENCE_THRESHOLD = 0.30   # bloquear si confianza < este valor
NO_RESPOND_UNCERTAINTY_THRESHOLD = 0.72  # bloquear si entropía normalizada > este valor
_TEMPERATURE = 1.2                       # factor de temperatura (Platt scaling leve)

# Features cuyo valor binario exacto (0.0 / 1.0) merece advertencia clínica
_BINARY_FEATURE_WATCHLIST = {
    "tachycardia", "fever", "dyspnea", "chest_pain",
    "hypoxia", "hypotension", "altered_consciousness",
}


@dataclass(frozen=True)
class DecisionResult:
    risk_level: str
    suspected_condition: str
    clinical_interpretation: str
    confidence: float
    action_plan: str
    urgency: str
    follow_up_hours: int
    red_flags: list[str]
    recommended_tests: list[str]
    model_evidence: dict[str, Any]
    # --- Ajustes finos v2 ---
    rule_priority: int            # prioridad de la regla que disparó (1=más urgente)
    decision_score: float         # score compuesto 0-1 (riesgo + confianza + certeza)
    confidence_band: str          # low / medium / high
    calibrated_confidence: float  # confianza con temperature-scaling aplicado
    uncertainty: float            # entropía normalizada del modelo (0=cierto, 1=máx. duda)
    deferred: bool                # True → sistema bloqueó la decisión (NO_RESPOND)
    defer_reason: str | None      # motivo del bloqueo si deferred=True
    feature_warnings: list[str]   # features con posible sobreinterpretación clínica


class DecisionEngine:
    # ------------------------------------------------------------------
    # Utilidades de scoring y calibración
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_uncertainty(probabilities: dict[str, float], confidence: float) -> float:
        """Entropía normalizada de la distribución de probabilidades.
        Si no hay distribución disponible, usa 1 - confidence como proxy.
        Rango: 0 (certeza absoluta) → 1 (máxima incertidumbre)."""
        vals = [v for v in probabilities.values() if v > 0.0]
        if len(vals) < 2:
            return round(1.0 - confidence, 4)
        entropy = -sum(v * math.log(v) for v in vals)
        max_entropy = math.log(len(vals))
        return round(entropy / max_entropy, 4) if max_entropy > 0 else round(1.0 - confidence, 4)

    @staticmethod
    def _calibrate_confidence(confidence: float) -> float:
        """Temperature scaling leve (T=1.2) para amortiguar sobreconfianza.
        Devuelve confianza calibrada en [0, 1]."""
        eps = 1e-7
        p = max(eps, min(confidence, 1 - eps))
        logit = math.log(p / (1.0 - p))
        scaled = logit / _TEMPERATURE
        calibrated = 1.0 / (1.0 + math.exp(-scaled))
        return round(calibrated, 4)

    @staticmethod
    def _confidence_band(calibrated: float) -> str:
        if calibrated >= 0.75:
            return "high"
        if calibrated >= 0.50:
            return "medium"
        return "low"

    @staticmethod
    def _decision_score(risk_level: str, calibrated: float, uncertainty: float) -> float:
        """Score compuesto [0, 1]: combina riesgo clínico, confianza calibrada y certeza."""
        risk_num = {"high": 1.0, "medium": 0.6, "low": 0.3}.get(risk_level, 0.3)
        score = 0.40 * risk_num + 0.35 * calibrated + 0.25 * (1.0 - uncertainty)
        return round(max(0.0, min(score, 1.0)), 4)

    @staticmethod
    def _check_feature_warnings(features_used: dict[str, float]) -> list[str]:
        """Detecta features binarias en watchlist cuyo valor exacto (0/1) puede
        inducir sobreinterpretación clínica."""
        warnings: list[str] = []
        for name, val in features_used.items():
            key = name.lower()
            if key in _BINARY_FEATURE_WATCHLIST and val in (0.0, 1.0):
                warnings.append(
                    f"'{name}'={val:.1f}: feature binaria — confirmar con examen clínico directo"
                )
        return warnings

    @staticmethod
    def _check_no_respond(confidence: float, uncertainty: float) -> str | None:
        """Devuelve motivo si la decisión debe bloquearse, None si puede continuar."""
        if confidence < NO_RESPOND_CONFIDENCE_THRESHOLD:
            return (
                f"Confianza del modelo ({confidence:.0%}) por debajo del umbral mínimo "
                f"({NO_RESPOND_CONFIDENCE_THRESHOLD:.0%}). Decisión clínica automática bloqueada."
            )
        if uncertainty > NO_RESPOND_UNCERTAINTY_THRESHOLD:
            return (
                f"Incertidumbre del modelo ({uncertainty:.0%}) supera el límite aceptable "
                f"({NO_RESPOND_UNCERTAINTY_THRESHOLD:.0%}). Revisión manual obligatoria."
            )
        return None

    # ------------------------------------------------------------------
    # Punto de entrada principal
    # ------------------------------------------------------------------

    def interpret(
        self,
        model_output: dict[str, Any],
        patient_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        ctx = patient_context or {}

        normalized = self._normalize_model_output(model_output)
        finding = normalized["finding"]
        confidence = normalized["confidence"]
        modality = normalized["modality"]
        model_risk = normalized["model_risk_level"]
        probabilities: dict[str, float] = normalized.get("probabilities") or {}
        features_used: dict[str, float] = model_output.get("features_used") or {}

        # --- Métricas derivadas ---
        calibrated = self._calibrate_confidence(confidence)
        uncertainty = self._compute_uncertainty(probabilities, confidence)
        feature_warnings = self._check_feature_warnings(features_used)

        # --- Política NO_RESPOND ---
        defer_reason = self._check_no_respond(confidence, uncertainty)
        if defer_reason:
            return asdict(
                self._rule_deferred(
                    confidence=confidence,
                    calibrated=calibrated,
                    uncertainty=uncertainty,
                    defer_reason=defer_reason,
                    model_evidence=normalized,
                    feature_warnings=feature_warnings,
                )
            )

        symptoms = [str(s).lower() for s in ctx.get("symptoms", [])]
        age = int(ctx.get("age", 0) or 0)
        has_fever = "fiebre" in symptoms or "fever" in symptoms
        has_dyspnea = "disnea" in symptoms or "dyspnea" in symptoms
        has_chest_pain = "dolor_toracico" in symptoms or "chest_pain" in symptoms
        has_trauma = "trauma" in symptoms or "caida" in symptoms or "fall" in symptoms

        risk_level = self._classify_risk(
            finding=finding,
            model_risk=model_risk,
            confidence=confidence,
            has_fever=has_fever,
            has_dyspnea=has_dyspnea,
            has_chest_pain=has_chest_pain,
            has_trauma=has_trauma,
            age=age,
        )

        # --- Kwargs compartidos entre reglas ---
        scoring_kwargs = dict(
            calibrated=calibrated,
            uncertainty=uncertainty,
            feature_warnings=feature_warnings,
        )

        if finding == "possible_pneumonia":
            return asdict(
                self._rule_pneumonia(
                    risk_level=risk_level,
                    confidence=confidence,
                    modality=modality,
                    has_fever=has_fever,
                    has_dyspnea=has_dyspnea,
                    has_chest_pain=has_chest_pain,
                    age=age,
                    model_evidence=normalized,
                    **scoring_kwargs,
                )
            )

        if finding == "possible_fracture":
            return asdict(
                self._rule_fracture(
                    risk_level=risk_level,
                    confidence=confidence,
                    modality=modality,
                    has_trauma=has_trauma,
                    age=age,
                    model_evidence=normalized,
                    **scoring_kwargs,
                )
            )

        return asdict(
            self._rule_normal(
                risk_level=risk_level,
                confidence=confidence,
                modality=modality,
                symptoms=symptoms,
                age=age,
                model_evidence=normalized,
                **scoring_kwargs,
            )
        )

    def _normalize_model_output(self, model_output: dict[str, Any]) -> dict[str, Any]:
        finding = str(model_output.get("finding", "")).strip().lower()
        finding_code = str(model_output.get("finding_code", "")).strip().lower()

        if not finding and finding_code:
            finding = {
                "image_quality_acceptable": "normal",
                "image_requires_targeted_review": "normal",
                "image_quality_or_pattern_alert": "possible_fracture",
                "critical_alert_pattern": "possible_pneumonia",
                "needs_clinical_review": "possible_pneumonia",
                "stable_pattern": "normal",
            }.get(finding_code, "normal")

        if finding not in {"normal", "possible_pneumonia", "possible_fracture"}:
            finding = "normal"

        model_risk_level = str(model_output.get("risk_level", "")).strip().lower()
        if model_risk_level not in {"low", "medium", "high"}:
            model_risk_level = "unknown"

        modality = str(model_output.get("modality", "XRAY")).upper()
        confidence = float(model_output.get("confidence", 0.0))
        confidence = max(0.0, min(confidence, 1.0))

        probabilities = model_output.get("probabilities")
        if not isinstance(probabilities, dict):
            probabilities = {}

        recommendation_code = str(model_output.get("recommendation_code", "")).strip().lower()

        return {
            "finding": finding,
            "finding_code": finding_code,
            "model_risk_level": model_risk_level,
            "modality": modality,
            "confidence": round(confidence, 4),
            "probabilities": probabilities,
            "recommendation_code": recommendation_code,
        }

    def _classify_risk(
        self,
        finding: str,
        model_risk: str,
        confidence: float,
        has_fever: bool,
        has_dyspnea: bool,
        has_chest_pain: bool,
        has_trauma: bool,
        age: int,
    ) -> str:
        score = {
            "low": 20,
            "medium": 50,
            "high": 75,
            "unknown": 35,
        }[model_risk]

        score += int(confidence * 20)
        score += {
            "normal": -10,
            "possible_pneumonia": 20,
            "possible_fracture": 15,
        }[finding]

        if has_fever:
            score += 8
        if has_dyspnea:
            score += 15
        if has_chest_pain:
            score += 15
        if has_trauma:
            score += 12
        if age >= 65:
            score += 10

        if score >= 75:
            return "high"
        if score >= 45:
            return "medium"
        return "low"

    def _rule_pneumonia(
        self,
        risk_level: str,
        confidence: float,
        modality: str,
        has_fever: bool,
        has_dyspnea: bool,
        has_chest_pain: bool,
        age: int,
        model_evidence: dict[str, Any],
        calibrated: float,
        uncertainty: float,
        feature_warnings: list[str],
    ) -> DecisionResult:
        red_flags: list[str] = []
        if has_fever:
            red_flags.append("fever")
        if has_dyspnea:
            red_flags.append("dyspnea")
        if has_chest_pain:
            red_flags.append("chest_pain")
        if age >= 65:
            red_flags.append("age_over_65")

        if risk_level == "high":
            action_plan = "urgent_er_referral"
            urgency = "immediate"
            follow_up_hours = 0
        elif risk_level == "medium":
            action_plan = "same_day_clinical_review"
            urgency = "urgent"
            follow_up_hours = 6
        else:
            action_plan = "priority_outpatient_review"
            urgency = "priority"
            follow_up_hours = 12

        return DecisionResult(
            risk_level=risk_level,
            suspected_condition="pneumonia_possible",
            clinical_interpretation=(
                "Patron radiologico compatible con proceso infeccioso pulmonar. "
                "Requiere correlacion clinica, examen fisico y confirmacion medica."
            ),
            confidence=round(confidence, 4),
            action_plan=action_plan,
            urgency=urgency,
            follow_up_hours=follow_up_hours,
            red_flags=red_flags,
            recommended_tests=["chest_xray_followup", "cbc", "crp", "pulse_oximetry"],
            model_evidence=model_evidence,
            rule_priority=RULE_PRIORITIES["possible_pneumonia"],
            decision_score=self._decision_score(risk_level, calibrated, uncertainty),
            confidence_band=self._confidence_band(calibrated),
            calibrated_confidence=calibrated,
            uncertainty=uncertainty,
            deferred=False,
            defer_reason=None,
            feature_warnings=feature_warnings,
        )

    def _rule_fracture(
        self,
        risk_level: str,
        confidence: float,
        modality: str,
        has_trauma: bool,
        age: int,
        model_evidence: dict[str, Any],
        calibrated: float,
        uncertainty: float,
        feature_warnings: list[str],
    ) -> DecisionResult:
        red_flags: list[str] = []
        if has_trauma:
            red_flags.append("recent_trauma")
        if age >= 70:
            red_flags.append("fragility_risk")

        if risk_level == "high":
            action_plan = "immobilize_and_urgent_orthopedic_assessment"
            urgency = "urgent"
            follow_up_hours = 4
        elif risk_level == "medium":
            action_plan = "orthopedic_assessment_priority"
            urgency = "priority"
            follow_up_hours = 12
        else:
            action_plan = "clinical_followup_with_precautions"
            urgency = "routine"
            follow_up_hours = 24

        return DecisionResult(
            risk_level=risk_level,
            suspected_condition="fracture_possible",
            clinical_interpretation=(
                "Hallazgos de imagen compatibles con probable lesion o fractura osea. "
                "Se recomienda confirmacion por radiologia y valoracion traumatologica."
            ),
            confidence=round(confidence, 4),
            action_plan=action_plan,
            urgency=urgency,
            follow_up_hours=follow_up_hours,
            red_flags=red_flags,
            recommended_tests=["targeted_xray_views", "orthopedic_exam"],
            model_evidence=model_evidence,
            rule_priority=RULE_PRIORITIES["possible_fracture"],
            decision_score=self._decision_score(risk_level, calibrated, uncertainty),
            confidence_band=self._confidence_band(calibrated),
            calibrated_confidence=calibrated,
            uncertainty=uncertainty,
            deferred=False,
            defer_reason=None,
            feature_warnings=feature_warnings,
        )

    def _rule_normal(
        self,
        risk_level: str,
        confidence: float,
        modality: str,
        symptoms: list[str],
        age: int,
        model_evidence: dict[str, Any],
        calibrated: float,
        uncertainty: float,
        feature_warnings: list[str],
    ) -> DecisionResult:
        symptomatic = len(symptoms) > 0

        if risk_level == "high":
            action_plan = "priority_clinical_reassessment"
            urgency = "urgent"
            follow_up_hours = 6
        elif risk_level == "medium":
            action_plan = "clinical_followup"
            urgency = "priority"
            follow_up_hours = 24
        else:
            action_plan = "routine_monitoring"
            urgency = "routine"
            follow_up_hours = 72

        return DecisionResult(
            risk_level=risk_level,
            suspected_condition="no_critical_imaging_pattern",
            clinical_interpretation=(
                "No se identifican hallazgos criticos evidentes en la imagen. "
                "Mantener vigilancia clinica segun evolucion de sintomas."
            ),
            confidence=round(confidence, 4),
            action_plan=action_plan,
            urgency=urgency,
            follow_up_hours=follow_up_hours,
            red_flags=["clinical_symptoms_present"] if symptomatic else [],
            recommended_tests=["repeat_imaging_if_worsening"] if symptomatic else [],
            model_evidence=model_evidence,
            rule_priority=RULE_PRIORITIES["normal"],
            decision_score=self._decision_score(risk_level, calibrated, uncertainty),
            confidence_band=self._confidence_band(calibrated),
            calibrated_confidence=calibrated,
            uncertainty=uncertainty,
            deferred=False,
            defer_reason=None,
            feature_warnings=feature_warnings,
        )

    def _rule_deferred(
        self,
        confidence: float,
        calibrated: float,
        uncertainty: float,
        defer_reason: str,
        model_evidence: dict[str, Any],
        feature_warnings: list[str],
    ) -> DecisionResult:
        """Regla de bloqueo: incertidumbre demasiado alta para emitir decisión clínica."""
        return DecisionResult(
            risk_level="unknown",
            suspected_condition="deferred_insufficient_confidence",
            clinical_interpretation=(
                "El sistema ha bloqueado la decision automatica por alta incertidumbre. "
                "Se requiere revision medica directa antes de cualquier accion clinica."
            ),
            confidence=round(confidence, 4),
            action_plan="mandatory_manual_clinical_review",
            urgency="deferred",
            follow_up_hours=0,
            red_flags=["high_model_uncertainty"],
            recommended_tests=["repeat_study_or_alternative_modality"],
            model_evidence=model_evidence,
            rule_priority=0,   # máxima prioridad de visibilidad (marcador especial)
            decision_score=0.0,
            confidence_band="low",
            calibrated_confidence=calibrated,
            uncertainty=uncertainty,
            deferred=True,
            defer_reason=defer_reason,
            feature_warnings=feature_warnings,
        )


def interpret_prediction(
    model_output: dict[str, Any],
    patient_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    engine = DecisionEngine()
    return engine.interpret(model_output=model_output, patient_context=patient_context)
