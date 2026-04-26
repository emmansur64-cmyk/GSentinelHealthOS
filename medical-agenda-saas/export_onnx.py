#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

import torch

from dl.model import build_default_model


class OnnxWrapper(torch.nn.Module):
    def __init__(self, base_model: torch.nn.Module) -> None:
        super().__init__()
        self.base_model = base_model

    def forward(self, x: torch.Tensor):
        out = self.base_model(x)
        return out["study_logits"], out["region_logits"], out["findings_logits"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Exportar modelo medico a ONNX")
    parser.add_argument("--weights", default="models/medical_model.pt", type=str)
    parser.add_argument("--onnx", default="models/medical_model_v1.onnx", type=str)
    parser.add_argument("--channels", default=3, type=int)
    parser.add_argument("--size", default=224, type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    weights_path = Path(args.weights)
    onnx_path = Path(args.onnx)
    onnx_path.parent.mkdir(parents=True, exist_ok=True)

    model = build_default_model()
    model.load_state_dict(torch.load(weights_path, map_location="cpu"))
    model.eval()

    wrapper = OnnxWrapper(model)
    dummy_input = torch.randn(1, args.channels, args.size, args.size)

    torch.onnx.export(
        wrapper,
        dummy_input,
        str(onnx_path),
        input_names=["input"],
        output_names=["study_logits", "region_logits", "findings_logits"],
        dynamic_axes={
            "input": {0: "batch"},
            "study_logits": {0: "batch"},
            "region_logits": {0: "batch"},
            "findings_logits": {0: "batch"},
        },
        opset_version=17,
    )

    print(f"ONNX exportado: {onnx_path}")


if __name__ == "__main__":
    main()
