from __future__ import annotations

from dataclasses import dataclass

import numpy as np


RISK_LABELS: tuple[str, str, str] = ("low", "medium", "high")


@dataclass(frozen=True)
class TextDataset:
    texts: list[str]
    labels: list[str]


@dataclass(frozen=True)
class ImageDataset:
    features: list[dict[str, float | str]]
    labels: list[str]


def build_text_dataset() -> TextDataset:
    low_templates = [
        "Paciente con {s1} {s2} sin signos de alarma.",
        "Consulta por {s1} y {s2}, hemodinamicamente estable.",
        "Cuadro de {s1} con {s2}; tolera via oral.",
    ]
    medium_templates = [
        "Paciente con {s1} y {s2}; requiere evaluacion prioritaria.",
        "Presenta {s1}, {s2} y dolor moderado.",
        "Episodio de {s1} con {s2}; necesita estudios complementarios.",
    ]
    high_templates = [
        "Paciente con {s1} y {s2}; inestabilidad clinica y riesgo alto.",
        "Caso critico con {s1}, {s2} y deterioro rapido.",
        "Sospecha de emergencia por {s1} asociado a {s2}.",
    ]

    low_symptoms = [
        "dolor leve",
        "tos seca",
        "cefalea tensional",
        "fiebre baja",
        "odinia",
        "malestar general",
        "rinitis",
        "nauseas leves",
    ]
    medium_symptoms = [
        "disnea moderada",
        "fiebre persistente",
        "dolor toracico atipico",
        "taquicardia",
        "hipoxemia leve",
        "vomitos repetidos",
        "dolor abdominal moderado",
        "mareo intenso",
    ]
    high_symptoms = [
        "shock",
        "sepsis",
        "hemorragia activa",
        "dolor toracico severo",
        "disnea severa",
        "convulsion activa",
        "saturacion 80",
        "anuria",
    ]

    texts: list[str] = []
    labels: list[str] = []

    for t in low_templates:
        for i, s1 in enumerate(low_symptoms):
            s2 = low_symptoms[(i + 3) % len(low_symptoms)]
            texts.append(t.format(s1=s1, s2=s2))
            labels.append("low")

    for t in medium_templates:
        for i, s1 in enumerate(medium_symptoms):
            s2 = medium_symptoms[(i + 2) % len(medium_symptoms)]
            texts.append(t.format(s1=s1, s2=s2))
            labels.append("medium")

    for t in high_templates:
        for i, s1 in enumerate(high_symptoms):
            s2 = high_symptoms[(i + 4) % len(high_symptoms)]
            texts.append(t.format(s1=s1, s2=s2))
            labels.append("high")

    return TextDataset(texts=texts, labels=labels)


def build_image_dataset(seed: int = 42, n_per_class: int = 240) -> ImageDataset:
    rng = np.random.default_rng(seed)

    features: list[dict[str, float | str]] = []
    labels: list[str] = []

    def add_sample(label: str, modality: str, pixels_million: float, aspect_ratio: float, bytes_per_pixel: float) -> None:
        features.append(
            {
                "pixels_million": float(round(pixels_million, 6)),
                "aspect_ratio": float(round(aspect_ratio, 6)),
                "bytes_per_pixel": float(round(bytes_per_pixel, 8)),
                "modality": modality,
            }
        )
        labels.append(label)

    modalities = ["XRAY", "CT", "MRI"]
    for _ in range(n_per_class):
        modality = modalities[int(rng.integers(0, len(modalities)))]

        add_sample(
            "low",
            modality,
            pixels_million=rng.normal(1.1, 0.2),
            aspect_ratio=rng.normal(1.0, 0.08),
            bytes_per_pixel=rng.normal(0.8, 0.12),
        )
        add_sample(
            "medium",
            modality,
            pixels_million=rng.normal(0.8, 0.25),
            aspect_ratio=rng.normal(1.2, 0.2),
            bytes_per_pixel=rng.normal(0.6, 0.14),
        )
        add_sample(
            "high",
            modality,
            pixels_million=rng.normal(0.45, 0.18),
            aspect_ratio=rng.normal(1.5, 0.25),
            bytes_per_pixel=rng.normal(0.35, 0.1),
        )

    return ImageDataset(features=features, labels=labels)
