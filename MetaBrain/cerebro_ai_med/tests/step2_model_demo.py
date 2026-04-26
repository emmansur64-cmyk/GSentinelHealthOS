import os

from fastapi.testclient import TestClient

from cerebro_ai_med.main import app
from cerebro_ai_med.models import ModelInput, get_model_service
from cerebro_ai_med.models.train_models import train_and_save_models


def run_step2_demo() -> None:
    os.environ.setdefault("CEREBRO_API_KEY", "step2-demo-key")

    train_and_save_models()
    model = get_model_service()

    text_output = model.predict(
        ModelInput(
            source_type="text",
            modality="TEXT",
            text="Paciente con disnea, dolor toracico y fiebre alta.",
        )
    )
    assert text_output.risk_level in {"low", "medium", "high"}
    assert 0.0 <= text_output.confidence <= 1.0

    image_output = model.predict(
        ModelInput(
            source_type="image",
            modality="XRAY",
            image_bytes=256000,
            image_width=1024,
            image_height=1024,
            image_format="png",
        )
    )
    assert image_output.risk_level in {"low", "medium", "high"}

    client = TestClient(app)
    response = client.post(
        "/analyze",
        json={
            "input_type": "text",
            "modality": "TEXT",
            "text": "Paciente con dolor abdominal leve sin signos de alarma.",
        },
        headers={"X-API-Key": os.environ["CEREBRO_API_KEY"]},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "inference" in payload
    assert payload["inference"]["model_name"] == "production_medical_triage"

    print("PASO 2 demo OK")


if __name__ == "__main__":
    run_step2_demo()
