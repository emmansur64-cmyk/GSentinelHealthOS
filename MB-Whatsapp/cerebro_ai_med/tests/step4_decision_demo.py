from pprint import pprint

from cerebro_ai_med.decision.decision_engine import interpret_prediction


def run_demo() -> None:
    case_1_model = {
        "finding_code": "critical_alert_pattern",
        "risk_level": "high",
        "confidence": 0.91,
        "modality": "XRAY",
        "probabilities": {"low": 0.03, "medium": 0.08, "high": 0.89},
        "recommendation_code": "urgent_immediate_evaluation",
    }
    case_1_ctx = {
        "age": 72,
        "symptoms": ["fiebre", "disnea", "dolor_toracico"],
    }

    case_2_model = {
        "finding": "possible_fracture",
        "risk_level": "medium",
        "confidence": 0.79,
        "modality": "XRAY",
        "probabilities": {"low": 0.1, "medium": 0.7, "high": 0.2},
    }
    case_2_ctx = {
        "age": 44,
        "symptoms": ["trauma"],
    }

    case_3_model = {
        "finding": "normal",
        "risk_level": "low",
        "confidence": 0.88,
        "modality": "RMN",
        "probabilities": {"low": 0.88, "medium": 0.1, "high": 0.02},
    }
    case_3_ctx = {
        "age": 29,
        "symptoms": [],
    }

    print("=== CASE 1 ===")
    pprint(interpret_prediction(case_1_model, case_1_ctx))

    print("=== CASE 2 ===")
    pprint(interpret_prediction(case_2_model, case_2_ctx))

    print("=== CASE 3 ===")
    pprint(interpret_prediction(case_3_model, case_3_ctx))


if __name__ == "__main__":
    run_demo()
