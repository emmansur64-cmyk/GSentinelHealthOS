from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

import torch
import torch.nn as nn
import torchvision.models as models


@dataclass
class HeadConfig:
    study_type_classes: int = 3
    region_classes: int = 3
    findings_classes: int = 3


class MedicalMultiHeadModel(nn.Module):
    """
    Backbone unico + 3 cabezas:
      - tipo de estudio (MRI/XRAY/CT)
      - region anatomica (knee/chest/spine)
      - hallazgo basico (effusion/fracture/none)
    """

    def __init__(self, cfg: HeadConfig) -> None:
        super().__init__()
        backbone = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        in_features = backbone.fc.in_features
        backbone.fc = nn.Identity()
        self.backbone = backbone

        self.study_head = nn.Linear(in_features, cfg.study_type_classes)
        self.region_head = nn.Linear(in_features, cfg.region_classes)
        self.findings_head = nn.Linear(in_features, cfg.findings_classes)

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        features = self.backbone(x)
        return {
            "study_logits": self.study_head(features),
            "region_logits": self.region_head(features),
            "findings_logits": self.findings_head(features),
        }


def build_default_model() -> MedicalMultiHeadModel:
    return MedicalMultiHeadModel(HeadConfig())
