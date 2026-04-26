from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

import numpy as np
import torch
from PIL import Image


@dataclass(frozen=True)
class ImagePreprocessConfig:
    target_size: tuple[int, int] = (224, 224)
    clip_sigma: float = 3.0


@dataclass(frozen=True)
class ImagePreprocessResult:
    tensor: torch.Tensor
    original_width: int
    original_height: int
    normalized_mean: float
    normalized_std: float


class ImagePreprocessor:
    def __init__(self, config: ImagePreprocessConfig | None = None) -> None:
        self.config = config or ImagePreprocessConfig()

    def preprocess(self, image_bytes: bytes) -> ImagePreprocessResult:
        image = Image.open(BytesIO(image_bytes)).convert("L")
        width, height = image.size
        image = image.resize(self.config.target_size)

        arr = np.asarray(image, dtype=np.float32) / 255.0
        mean = float(arr.mean())
        std = float(arr.std())
        std_safe = std if std > 1e-6 else 1.0

        normalized = (arr - mean) / std_safe
        normalized = np.clip(
            normalized,
            -self.config.clip_sigma,
            self.config.clip_sigma,
        )

        tensor = torch.from_numpy(normalized).unsqueeze(0).unsqueeze(0)

        return ImagePreprocessResult(
            tensor=tensor,
            original_width=width,
            original_height=height,
            normalized_mean=mean,
            normalized_std=std,
        )