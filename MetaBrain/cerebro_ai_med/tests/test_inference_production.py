from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cerebro_ai_med.main import app
from cerebro_ai_med.models import ModelInput, get_model_service
from cerebro_ai_med.models.registry import compute_sha256, parse_active_spec


ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "models" / "artifacts"
REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
API_KEY = "prod-test-api-key"


@pytest.fixture(autouse=True)
def _set_api_key() -> None:
    os.environ["CEREBRO_API_KEY"] = API_KEY


@pytest.fixture(scope="module")
def active_model_spec():
    assert REGISTRY_PATH.exists(), f"registry_not_found: {REGISTRY_PATH}"
    spec = parse_active_spec(REGISTRY_PATH)
    assert spec.text_artifact.path.exists(), "text_artifact_missing"
    assert spec.image_artifact.path.exists(), "image_artifact_missing"

    # Integrity check against registry checksums.
    assert compute_sha256(spec.text_artifact.path) == spec.text_artifact.sha256
    assert compute_sha256(spec.image_artifact.path) == spec.image_artifact.sha256
    return spec


def _assert_probability_contract(output) -> None:
    probs = output.probabilities
    assert set(probs.keys()) == {"low", "medium", "high"}
    assert 0.0 <= output.confidence <= 1.0
    assert all(0.0 <= float(v) <= 1.0 for v in probs.values())
    assert sum(float(v) for v in probs.values()) == pytest.approx(1.0, abs=1e-6)

    predicted = max(probs, key=probs.get)
    assert output.risk_level == predicted


def test_model_loader_and_runtime_inference_with_persisted_artifacts(active_model_spec) -> None:
    model = get_model_service()

    # Loader must expose active version from persisted registry.
    assert model.model_version == active_model_spec.version

    realistic_cases = [
        {
            "name": "normal_mild_case",
            "input": ModelInput(
                source_type="text",
                modality="TEXT",
                text="Cefalea leve intermitente sin fiebre ni dificultad respiratoria, tolera via oral.",
            ),
            "expected_risk": {"low", "medium"},
        },
        {
            "name": "ambiguous_case",
            "input": ModelInput(
                source_type="text",
                modality="TEXT",
                text="Dolor abdominal de 24 horas con nausea, sin vomito persistente, hemodinamicamente estable.",
            ),
            "expected_risk": {"low", "medium"},
        },
        {
            "name": "critical_case",
            "input": ModelInput(
                source_type="text",
                modality="TEXT",
                text="Paciente con dolor toracico opresivo intenso, disnea severa, diaforesis e hipotension.",
            ),
            "expected_risk": {"high"},
        },
        {
            "name": "image_realistic_metadata",
            "input": ModelInput(
                source_type="image",
                modality="XRAY",
                image_bytes=620_000,
                image_width=768,
                image_height=512,
                image_format="png",
            ),
            "expected_risk": {"low", "medium", "high"},
        },
    ]

    for case in realistic_cases:
        output = model.predict(case["input"])
        _assert_probability_contract(output)
        assert output.risk_level in case["expected_risk"], f"unexpected_risk_for_case={case['name']}"


def test_api_analyze_authenticated_response_contract_and_consistency() -> None:
    client = TestClient(app)

    payload = {
        "input_type": "text",
        "modality": "TEXT",
        "text": "Paciente con dolor toracico opresivo, disnea progresiva y diaforesis desde hace 40 minutos.",
    }
    response = client.post(
        "/analyze",
        json=payload,
        headers={"X-API-Key": API_KEY},
    )

    assert response.status_code == 200
    body = response.json()

    # Full response structure checks.
    assert body["status"] == "accepted"
    assert "timestamp_utc" in body
    assert body["input"]["type"] == "text"
    assert body["input"]["modality"] == "TEXT"
    assert body["input"]["summary"]["text_length"] == len(payload["text"])
    assert body["pipeline"]["step"] == "api_base"
    assert body["pipeline"]["next_step"] == "models_baseline"

    inference = body["inference"]
    assert inference["model_name"] == "production_medical_triage"
    assert isinstance(inference["model_version"], str) and len(inference["model_version"]) > 0
    assert inference["risk_level"] in {"low", "medium", "high"}
    assert isinstance(inference["finding_code"], str) and len(inference["finding_code"]) > 0
    assert isinstance(inference["recommendation_code"], str) and len(inference["recommendation_code"]) > 0
    assert isinstance(inference["features_used"], dict)

    probabilities = inference["probabilities"]
    assert set(probabilities.keys()) == {"low", "medium", "high"}
    assert 0.0 <= float(inference["confidence"]) <= 1.0
    assert all(0.0 <= float(v) <= 1.0 for v in probabilities.values())
    assert sum(float(v) for v in probabilities.values()) == pytest.approx(1.0, abs=1e-6)
    assert inference["risk_level"] == max(probabilities, key=probabilities.get)

    joint = body["joint_decision"]
    assert joint["final_risk_level"] in {"low", "medium", "high", "unknown"}
    assert joint["consensus"] in {"aligned", "escalated_by_groq", "cerebro_primary"}
    assert joint["source_count"] == 2
    assert set(joint["sources"]) == {"cerebro_rules", "groq_pipeline"}
    assert joint["cerebro"]["risk_level"] in {"low", "medium", "high", "unknown"}
    assert joint["groq"]["risk_level"] in {"low", "medium", "high", "unknown"}
    assert isinstance(joint["groq"]["stages_executed"], list)


def test_api_error_paths_no_key_invalid_input_and_invalid_content_type() -> None:
    client = TestClient(app)

    valid_text_payload = {
        "input_type": "text",
        "modality": "TEXT",
        "text": "Dolor de garganta leve, sin fiebre.",
    }

    # Missing API key.
    missing_key = client.post("/analyze", json=valid_text_payload)
    assert missing_key.status_code == 401
    assert missing_key.json().get("detail") == "invalid_api_key"

    # Invalid input_type in JSON.
    invalid_input = client.post(
        "/analyze",
        json={"input_type": "audio", "text": "test"},
        headers={"X-API-Key": API_KEY},
    )
    assert invalid_input.status_code == 400
    assert invalid_input.json().get("detail") == "input_type_must_be_text_or_image"

    # Incorrect content type.
    bad_content_type = client.post(
        "/analyze",
        data="plain text body",
        headers={"X-API-Key": API_KEY, "Content-Type": "text/plain"},
    )
    assert bad_content_type.status_code == 415
    assert bad_content_type.json().get("detail") == "content_type_must_be_application_json_or_multipart_form_data"
