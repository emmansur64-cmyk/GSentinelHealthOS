#!/usr/bin/env python3
"""
Preprocesamiento de imagenes medicas para entrenamiento DL.

Entrada esperada:
  data/raw/<split>/<label>/<archivo>

Salida:
  data/processed/<split>/<label>/<archivo>.pt

Tambien exporta un metadata.json por split para trazabilidad.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
from PIL import Image
from torchvision import transforms

try:
    import pydicom  # type: ignore
except Exception:  # pragma: no cover
    pydicom = None


SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".dcm", ".dicom"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Preprocesar imagenes medicas para entrenamiento")
    parser.add_argument("--input", type=str, default="data/raw", help="Directorio base de entrada")
    parser.add_argument("--output", type=str, default="data/processed", help="Directorio base de salida")
    parser.add_argument("--size", type=int, default=224, help="Tamano cuadrado de salida")
    parser.add_argument("--channels", type=int, choices=[1, 3], default=3, help="Canales de salida")
    parser.add_argument(
        "--splits",
        type=str,
        default="train,val,test",
        help="Splits separados por coma (ej: train,val,test)",
    )
    return parser.parse_args()


def load_image(path: Path) -> Image.Image:
    suffix = path.suffix.lower()
    if suffix in {".dcm", ".dicom"}:
        if pydicom is None:
            raise RuntimeError("pydicom no esta instalado. Instalar para soportar DICOM.")
        dataset = pydicom.dcmread(str(path))
        pixels = dataset.pixel_array.astype(np.float32)
        # Window/level simple para conservar contraste clinico basico.
        pmin, pmax = np.percentile(pixels, 1), np.percentile(pixels, 99)
        pixels = np.clip((pixels - pmin) / max(pmax - pmin, 1e-6), 0.0, 1.0)
        pixels = (pixels * 255).astype(np.uint8)
        return Image.fromarray(pixels).convert("L")

    return Image.open(path)


def build_transform(size: int, channels: int) -> transforms.Compose:
    convert = transforms.Grayscale(num_output_channels=channels) if channels == 1 else transforms.Lambda(lambda img: img.convert("RGB"))
    mean = [0.485, 0.456, 0.406] if channels == 3 else [0.5]
    std = [0.229, 0.224, 0.225] if channels == 3 else [0.25]

    return transforms.Compose(
        [
            convert,
            transforms.Resize((size, size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std),
        ]
    )


def collect_files(split_dir: Path) -> List[Tuple[Path, str]]:
    pairs: List[Tuple[Path, str]] = []
    for label_dir in sorted([p for p in split_dir.iterdir() if p.is_dir()]):
        label = label_dir.name
        for file_path in sorted(label_dir.rglob("*")):
            if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
                pairs.append((file_path, label))
    return pairs


def process_split(split: str, input_root: Path, output_root: Path, transform: transforms.Compose) -> Dict[str, object]:
    split_in = input_root / split
    split_out = output_root / split
    split_out.mkdir(parents=True, exist_ok=True)

    items = collect_files(split_in)
    metadata: List[Dict[str, object]] = []
    errors: List[str] = []

    for src, label in items:
        rel = src.relative_to(split_in)
        dst = split_out / rel
        dst = dst.with_suffix(".pt")
        dst.parent.mkdir(parents=True, exist_ok=True)

        try:
            img = load_image(src)
            tensor = transform(img)
            torch.save(tensor, dst)
            metadata.append(
                {
                    "source": str(src).replace("\\", "/"),
                    "tensor": str(dst).replace("\\", "/"),
                    "label": label,
                    "shape": list(tensor.shape),
                }
            )
        except Exception as exc:  # pragma: no cover
            errors.append(f"{src}: {exc}")

    (split_out / "metadata.json").write_text(
        json.dumps({"split": split, "items": metadata, "errors": errors}, ensure_ascii=True, indent=2),
        encoding="utf-8",
    )

    return {
        "split": split,
        "processed": len(metadata),
        "errors": len(errors),
    }


def main() -> None:
    args = parse_args()
    input_root = Path(args.input)
    output_root = Path(args.output)
    splits = [part.strip() for part in args.splits.split(",") if part.strip()]

    transform = build_transform(size=args.size, channels=args.channels)
    output_root.mkdir(parents=True, exist_ok=True)

    report = []
    for split in splits:
        report.append(process_split(split, input_root, output_root, transform))

    (output_root / "preprocess_report.json").write_text(
        json.dumps({"report": report, "size": args.size, "channels": args.channels}, ensure_ascii=True, indent=2),
        encoding="utf-8",
    )

    print(json.dumps({"status": "ok", "report": report}, ensure_ascii=True))


if __name__ == "__main__":
    main()
