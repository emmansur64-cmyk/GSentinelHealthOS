from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cerebro_ai_med.main import app
from cerebro_ai_med.models import ModelInput, get_model_service
from cerebro_ai_med.models.registry import parse_active_spec


ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "models" / "artifacts"
REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
API_KEY = "prod-test-api-key"
PERF_THRESHOLD_SECONDS = 0.200


GOLDEN_CASES_BY_VERSION = {
    "3.0.0": [
        {
            "name": "golden_low",
            "text": "Cefalea leve intermitente sin fiebre ni dificultad respiratoria, tolera via oral.",
            "expected_risk": "low",
            "expected_probabilities": {"low": 0.740122, "medium": 0.148584, "high": 0.111294},
        },
        {
            "name": "golden_ambiguous",
            "text": "Dolor abdominal de 24 horas con nausea, sin vomito persistente, hemodinamicamente estable.",
            "expected_risk": "low",
            "expected_probabilities": {"low": 0.506199, "medium": 0.340641, "high": 0.15316},
        },
        {
            "name": "golden_high",
            "text": "Paciente con dolor toracico opresivo intenso, disnea severa, diaforesis e hipotension.",
            "expected_risk": "high",
            "expected_probabilities": {"low": 0.164605, "medium": 0.411318, "high": 0.424076},
        },
    ]
}


@pytest.fixture(autouse=True)
def _set_api_key() -> None:
    os.environ["CEREBRO_API_KEY"] = API_KEY


@pytest.fixture(scope="module")
def active_spec():
    assert REGISTRY_PATH.exists(), f"registry_not_found: {REGISTRY_PATH}"
    return parse_active_spec(REGISTRY_PATH)


def _predict_text(text: str):
    model = get_model_service()
    return model.predict(ModelInput(source_type="text", modality="TEXT", text=text))


def _assert_probability_contract(output) -> None:
    probs = output.probabilities
    assert set(probs.keys()) == {"low", "medium", "high"}
    assert all(0.0 <= float(v) <= 1.0 for v in probs.values())
    # Model probabilities are rounded to 6 decimals in production output.
    assert sum(float(v) for v in probs.values()) == pytest.approx(1.0, abs=2e-6)
    assert output.risk_level == max(probs, key=probs.get)


def _assert_features_coherence(text: str, output) -> None:
    features = output.features_used
    assert isinstance(features, dict) and len(features) > 0

    # Basic coherence between input and engineered text features.
    assert float(features.get("token_count", 0.0)) >= 1.0
    assert float(features.get("char_count", 0.0)) == float(len(text.strip()))
    assert float(features.get("active_ngrams", 0.0)) >= 1.0


def test_determinism_same_input_same_exact_output() -> None:
    text = "Paciente con dolor toracico opresivo intenso, disnea severa, diaforesis e hipotension."

    baseline = _predict_text(text)
    for _ in range(8):
        current = _predict_text(text)
        assert current.model_version == baseline.model_version
        assert current.risk_level == baseline.risk_level
        assert current.confidence == baseline.confidence
        assert current.probabilities == baseline.probabilities
        assert current.features_used == baseline.features_used


def test_stability_repeated_api_requests_probability_drift_is_negligible() -> None:
    client = TestClient(app)
    payload = {
        "input_type": "text",
        "modality": "TEXT",
        "text": "Dolor abdominal de 24 horas con nausea, sin vomito persistente, hemodinamicamente estable.",
    }

    responses = []
    for _ in range(25):
        response = client.post("/analyze", json=payload, headers={"X-API-Key": API_KEY})
        assert response.status_code == 200
        responses.append(response.json()["inference"]["probabilities"])

    first = responses[0]
    for probs in responses[1:]:
        for label in ("low", "medium", "high"):
            assert abs(float(probs[label]) - float(first[label])) <= 1e-6


def test_edge_cases_clinical_texts_and_feature_integrity() -> None:
    edge_cases = [
        {
            "name": "contradictory_symptoms",
            "text": "Dolor toracico intenso pero tambien refiere mejoria completa y sin disnea al reposo.",
            "allowed": {"medium", "high"},
        },
        {
            "name": "incomplete_text",
            "text": "dolor pecho",
            "allowed": {"low", "medium", "high"},
        },
        {
            "name": "long_input",
            "text": (
                "Paciente con cefalea, malestar general y tos seca de inicio gradual. "
                "Niega dolor toracico, niega disnea de reposo, sin sincope. "
            )
            * 45,
            "allowed": {"low", "medium", "high"},
        },
        {
            "name": "noisy_typo_input",
            "text": "dolor toraxiko fuertte con disneaa i sudorazion fria",
            "allowed": {"medium", "high"},
        },
    ]

    for case in edge_cases:
        output = _predict_text(case["text"])
        _assert_probability_contract(output)
        _assert_features_coherence(case["text"], output)
        assert output.risk_level in case["allowed"], f"unexpected_risk_for_{case['name']}"


def test_advanced_clinical_validation_critical_patterns_no_false_negative_high_risk() -> None:
    critical_texts = [
        "Paciente con dolor toracico opresivo intenso, disnea severa, diaforesis e hipotension.",
        "Confusion aguda, saturacion 84%, taquipnea y uso de musculos accesorios.",
    ]

    for text in critical_texts:
        output = _predict_text(text)
        _assert_probability_contract(output)
        assert output.risk_level == "high", "critical_false_negative_detected"


def test_regression_golden_cases_by_model_version(active_spec) -> None:
    model_version = active_spec.version
    if model_version not in GOLDEN_CASES_BY_VERSION:
        pytest.skip(f"no_golden_cases_for_model_version={model_version}")

    for case in GOLDEN_CASES_BY_VERSION[model_version]:
        output = _predict_text(case["text"])
        assert output.risk_level == case["expected_risk"], f"golden_risk_regression={case['name']}"

        for label, expected in case["expected_probabilities"].items():
            assert output.probabilities[label] == pytest.approx(expected, abs=1e-6), (
                f"golden_probability_regression={case['name']}:{label}"
            )


def test_basic_performance_response_time_under_threshold() -> None:
    model = get_model_service()
    text = "Dolor abdominal de 24 horas con nausea, sin vomito persistente, hemodinamicamente estable."

    # Warm-up to avoid first-load cost in SLA assertion.
    _ = model.predict(ModelInput(source_type="text", modality="TEXT", text=text))

    total = 0.0
    runs = 40
    for _ in range(runs):
        start = time.perf_counter()
        _ = model.predict(ModelInput(source_type="text", modality="TEXT", text=text))
        total += time.perf_counter() - start

    avg_latency = total / runs
    assert avg_latency <= PERF_THRESHOLD_SECONDS, (
        f"performance_regression avg_latency={avg_latency:.6f}s threshold={PERF_THRESHOLD_SECONDS:.3f}s"
    )


def test_concurrent_api_requests_consistency() -> None:
    payload = {
        "input_type": "text",
        "modality": "TEXT",
        "text": "Dolor abdominal de 24 horas con nausea, sin vomito persistente, hemodinamicamente estable.",
    }

    def _single_call() -> dict:
        with TestClient(app) as client:
            response = client.post("/analyze", json=payload, headers={"X-API-Key": API_KEY})
            assert response.status_code == 200
            return response.json()["inference"]

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(lambda _: _single_call(), range(24)))

    baseline = results[0]
    for result in results[1:]:
        assert result["risk_level"] == baseline["risk_level"]
        assert result["confidence"] == baseline["confidence"]
        assert result["probabilities"] == baseline["probabilities"]
