from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn

from cerebro_ai_med.vision.preprocessing import ImagePreprocessor


class SmallMedicalCNN(nn.Module):
    def __init__(self, out_classes: int = 3) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 8, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(8, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((1, 1)),
        )
        self.classifier = nn.Linear(32, out_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = x.view(x.size(0), -1)
        return self.classifier(x)


@dataclass(frozen=True)
class ImagePrediction:
    status: str
    model: str
    modality: str
    finding: str
    confidence: float
    probabilities: dict[str, float]
    recommendation: str


class MedicalImagePredictor:
    LABELS = ["normal", "possible_pneumonia", "possible_fracture"]

    def __init__(self, model_path: str | None = None) -> None:
        self.device = torch.device("cpu")
        self.preprocessor = ImagePreprocessor()
        self.model, self.model_name = self._build_model()
        self.model.to(self.device)
        self.model.eval()

        if model_path:
            self._load_weights_if_exists(model_path)

    def predict(self, image_bytes: bytes, modality: str = "XRAY") -> dict[str, Any]:
        preprocess = self.preprocessor.preprocess(image_bytes)
        tensor = preprocess.tensor.to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()

        class_idx = int(np.argmax(probs))
        confidence = float(probs[class_idx])
        finding = self.LABELS[class_idx]

        recommendation = self._recommendation_from_finding(finding)
        probs_map = {
            label: float(round(prob, 4))
            for label, prob in zip(self.LABELS, probs.tolist())
        }

        result = ImagePrediction(
            status="success",
            model=self.model_name,
            modality=modality.upper(),
            finding=finding,
            confidence=round(confidence, 4),
            probabilities=probs_map,
            recommendation=recommendation,
        )

        payload = result.__dict__
        payload["image_meta"] = {
            "original_width": preprocess.original_width,
            "original_height": preprocess.original_height,
            "normalized_mean": round(preprocess.normalized_mean, 6),
            "normalized_std": round(preprocess.normalized_std, 6),
        }
        return payload

    def _build_model(self) -> tuple[nn.Module, str]:
        torch.manual_seed(42)

        try:
            from monai.networks.nets import DenseNet121

            model = DenseNet121(spatial_dims=2, in_channels=1, out_channels=len(self.LABELS))
            return model, "monai-densenet121-2d"
        except Exception:
            return SmallMedicalCNN(out_classes=len(self.LABELS)), "small-medical-cnn"

    def _load_weights_if_exists(self, model_path: str) -> None:
        path = Path(model_path)
        if not path.exists():
            return

        state = torch.load(path, map_location=self.device)
        if isinstance(state, dict) and "state_dict" in state:
            state = state["state_dict"]

        self.model.load_state_dict(state, strict=False)

    def _recommendation_from_finding(self, finding: str) -> str:
        if finding == "possible_pneumonia":
            return "correlate_with_clinical_and_consider_chest_ct"
        if finding == "possible_fracture":
            return "request_radiology_review_and_immobilization_protocol"
        return "no_urgent_pattern_continue_standard_followup"
