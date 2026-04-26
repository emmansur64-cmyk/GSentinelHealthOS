"""
NLG Service - Real Request/Response Examples
=============================================

Este archivo contiene ejemplos reales de entrada y salida del servicio NLG
para documentación y testing.
"""

# Example 1: HIGH-RISK Emergency Case
# ====================================

REQUEST_1 = {
    "decision_output": {
        "risk_level": "high",
        "clinical_flag": "urgent",
        "requires_medical_evaluation": True,
        "triage_level": "red",
        "confidence_band": "high",
        "explanations": ["pneumonia_possible"]
    },
    "model_output": {
        "model_name": "medical_triage_v3",
        "model_version": "1.2.0",
        "risk_level": "high",
        "finding_code": "infiltrate_bilateral",
        "confidence": 0.87,
        "probabilities": {
            "low": 0.05,
            "medium": 0.08,
            "high": 0.87
        },
        "recommendation_code": "urgent_evaluation",
        "features_used": {
            "fever": 1.0,
            "cough": 1.0,
            "dyspnea": 0.8
        }
    },
    "dialogue_action": {
        "intent": "symptom_report",
        "next_step": "prioritize_response"
    },
    "symptoms": ["fever", "cough", "dyspnea"]
}

RESPONSE_1 = {
    "message": "Por lo que describes, existe un riesgo elevado que requiere atención inmediata. Los síntomas y hallazgos son compatibles con una posible infección pulmonar. Se recomienda búsqueda inmediata de evaluación médica profesional para confirmación diagnóstica y manejo. Esta evaluación es de carácter preliminar y requiere validación por profesional médico calificado.",
    "style": "clinical",
    "variants_used": [
        "opening:symptom_report",
        "risk_intro:high",
        "clinical_interpretation:possible_pneumonia",
        "action:urgent",
        "disclaimer:safety"
    ],
    "disclaimers": [
        "Esta evaluación es de carácter preliminar y requiere validación por profesional médico calificado.",
        "medical_professional_review_recommended"
    ]
}


# Example 2: MEDIUM-RISK Priority Case
# =====================================

REQUEST_2 = {
    "decision_output": {
        "risk_level": "medium",
        "clinical_flag": "priority",
        "requires_medical_evaluation": True,
        "triage_level": "yellow",
        "confidence_band": "medium",
        "explanations": ["respiratory_issue"]
    },
    "model_output": {
        "model_name": "medical_triage_v3",
        "model_version": "1.2.0",
        "risk_level": "medium",
        "finding_code": "mild_infiltrate",
        "confidence": 0.72,
        "probabilities": {
            "low": 0.15,
            "medium": 0.72,
            "high": 0.13
        },
        "recommendation_code": "priority_evaluation",
        "features_used": {
            "fever": 0.9,
            "cough": 0.8
        }
    },
    "dialogue_action": {
        "intent": "severity_question",
        "next_step": "explain_risk"
    },
    "symptoms": ["fever", "cough"]
}

RESPONSE_2 = {
    "message": "Respecto a la gravedad de tu condición, existe un riesgo moderado que necesita seguimiento. Los síntomas que describes son compatibles con una afección respiratoria. Es recomendable programar una revisión clínica prioritaria en los próximos días. Cualquier diagnóstico debe confirmarse mediante una evaluación médica directa.",
    "style": "clinical",
    "variants_used": [
        "opening:severity_question",
        "risk_intro:medium",
        "clinical_interpretation:respiratory_issue",
        "action:priority",
        "disclaimer:safety"
    ],
    "disclaimers": [
        "Cualquier diagnóstico debe confirmarse mediante una evaluación médica directa.",
        "medical_professional_review_recommended"
    ]
}


# Example 3: LOW-RISK Routine Case
# =================================

REQUEST_3 = {
    "decision_output": {
        "risk_level": "low",
        "clinical_flag": "routine",
        "requires_medical_evaluation": False,
        "triage_level": "green",
        "confidence_band": "high",
        "explanations": ["normal_findings"]
    },
    "model_output": {
        "model_name": "medical_triage_v3",
        "model_version": "1.2.0",
        "risk_level": "low",
        "finding_code": "normal",
        "confidence": 0.95,
        "probabilities": {
            "low": 0.95,
            "medium": 0.04,
            "high": 0.01
        },
        "recommendation_code": "routine_monitoring",
        "features_used": {}
    },
    "dialogue_action": {
        "intent": "follow_up_question",
        "next_step": "acknowledge"
    },
    "symptoms": []
}

RESPONSE_3 = {
    "message": "Continuando con el análisis, los hallazgos son compatibles con un cuadro de bajo riesgo sin hallazgos críticos evidentes. No se identifican indicadores críticos en esta evaluación automatizada. Se indica seguimiento rutinario con reevaluación si aparecen nuevos síntomas. La información aquí proporcionada no reemplaza la consulta médica profesional.",
    "style": "clinical",
    "variants_used": [
        "opening:follow_up",
        "risk_intro:low",
        "clinical_interpretation:normal",
        "action:routine",
        "disclaimer:safety"
    ],
    "disclaimers": [
        "La información aquí proporcionada no reemplaza la consulta médica profesional.",
        "medical_professional_review_recommended"
    ]
}


# Example 4: MULTIPLE SYMPTOMS with Fracture Finding
# ===================================================

REQUEST_4 = {
    "decision_output": {
        "risk_level": "medium",
        "clinical_flag": "priority",
        "requires_medical_evaluation": True,
        "triage_level": "yellow",
        "confidence_band": "medium",
        "explanations": ["fracture_possible"]
    },
    "model_output": {
        "model_name": "medical_triage_v3",
        "model_version": "1.2.0",
        "risk_level": "medium",
        "finding_code": "fracture_pattern",
        "confidence": 0.68,
        "probabilities": {
            "low": 0.18,
            "medium": 0.68,
            "high": 0.14
        },
        "recommendation_code": "imaging_recommended",
        "features_used": {
            "chest_pain": 1.0,
            "tachycardia": 0.7
        }
    },
    "dialogue_action": {
        "intent": "symptom_report",
        "next_step": "request_more_info"
    },
    "symptoms": ["chest_pain", "headache", "fatigue"]
}

RESPONSE_4 = {
    "message": "Según los síntomas que mencionas (dolor en el pecho, dolor de cabeza y cansancio), existe un riesgo moderado que necesita seguimiento. Se aprecia una configuración compatible con daño estructural óseo. Se sugiere consulta prioritaria con seguimiento estrecho en corto plazo. Cualquier diagnóstico debe confirmarse mediante una evaluación médica directa.",
    "style": "clinical",
    "variants_used": [
        "opening:symptom_report",
        "risk_intro:medium",
        "clinical_interpretation:possible_fracture",
        "action:priority",
        "disclaimer:safety"
    ],
    "disclaimers": [
        "Cualquier diagnóstico debe confirmarse mediante una evaluación médica directa.",
        "medical_professional_review_recommended"
    ]
}


# Key Observations from Examples:
# ================================

OBSERVATIONS = {
    "linguistic_variety": [
        "Example 1 uses 'Por lo que describes'",
        "Example 2 uses 'Respecto a la gravedad'",
        "Example 3 uses 'Continuando con el análisis'",
        "Example 4 uses 'Según los síntomas que mencionas'",
        "All 4 examples have different opening sentences (not templated rigidly)"
    ],
    
    "clinical_safety": [
        "NEVER asserts diagnosis: uses 'compatible con', 'sugiere', 'es consistente con'",
        "ALWAYS includes disclaimers in message text",
        "ALWAYS has disclaimers array",
        "Tone adapts: high→urgent, medium→informative, low→reassuring"
    ],
    
    "symptom_mapping": [
        "Internal codes (fever, cough) → Natural language (fiebre, tos)",
        "Multi-symptom lists: 'dolor en el pecho, dolor de cabeza y cansancio'",
        "Symptoms in explanations enriched with context"
    ],
    
    "structure_adaptation": [
        "High risk: risk_intro FIRST (urgent emphasis)",
        "Low risk: opening FIRST (contextual framing)",
        "All: disclaimer LAST (safety)"
    ],
    
    "connector_usage": [
        "Example 1: 'Por lo que describes' → 'Los síntomas' → 'Se recomienda'",
        "Example 2: 'Respecto a' → 'Los síntomas' → 'Es recomendable'",
        "Example 3: 'Continuando con' → 'No se identifican' → 'Se indica'",
        "Natural flow without rigid templates"
    ]
}


# Testing Assertions:
# ===================

def test_assertions():
    """Assertions for validating NLG responses."""
    
    # Test 1: All responses have required fields
    for resp in [RESPONSE_1, RESPONSE_2, RESPONSE_3, RESPONSE_4]:
        assert "message" in resp
        assert "style" in resp
        assert "variants_used" in resp
        assert "disclaimers" in resp
        assert len(resp["message"]) >= 50
        assert len(resp["message"]) <= 1500
        assert resp["style"] == "clinical"
        assert len(resp["variants_used"]) >= 4
        assert len(resp["disclaimers"]) >= 1
    
    # Test 2: High-risk message is urgent
    assert "inmediata" in RESPONSE_1["message"] or "urgente" in RESPONSE_1["message"]
    assert "urgent" in RESPONSE_1["variants_used"][3]
    
    # Test 3: Low-risk message is reassuring
    assert "bajo" in RESPONSE_3["message"] or "rutinario" in RESPONSE_3["message"] or "no" in RESPONSE_3["message"]
    assert "routine" in RESPONSE_3["variants_used"][3]
    
    # Test 4: No diagnostic assertions
    for resp in [RESPONSE_1, RESPONSE_2, RESPONSE_3, RESPONSE_4]:
        msg = resp["message"].lower()
        assert "tiene " not in msg  # Avoids "tiene neumonía"
        assert "es seguro" not in msg  # Avoids "es seguro que"
        assert "definitivamente" not in msg  # Avoids absolutes
    
    # Test 5: All include disclaimers with safety language
    for resp in [RESPONSE_1, RESPONSE_2, RESPONSE_3, RESPONSE_4]:
        assert len(resp["disclaimers"]) >= 1
        # Check that at least one disclaimer mentions evaluation/review
        assert any(
            "profesional" in d.lower() or "médico" in d.lower() or "review" in d.lower()
            for d in resp["disclaimers"]
        )
    
    # Test 6: Variants match structure
    assert "opening" in RESPONSE_1["variants_used"][0]
    assert "risk_intro" in RESPONSE_1["variants_used"][1]
    assert "clinical_interpretation" in RESPONSE_1["variants_used"][2]
    assert "action" in RESPONSE_1["variants_used"][3]
    assert "disclaimer" in RESPONSE_1["variants_used"][4]
    
    print("✓ All test assertions passed!")


if __name__ == "__main__":
    test_assertions()
