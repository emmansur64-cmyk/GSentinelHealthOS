#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import accuracy_score, f1_score
from torch import nn
from torch.optim import Adam
from torch.utils.data import DataLoader, Dataset

from dl.model import build_default_model


LABEL_MAP = {
    "study_type": {"mri": 0, "xray": 1, "ct": 2},
    "region": {"knee": 0, "chest": 1, "spine": 2},
    "findings": {"effusion": 0, "fracture": 1, "none": 2},
}


class ProcessedTensorDataset(Dataset):
    def __init__(self, root: Path, split: str) -> None:
        self.samples: List[Tuple[Path, Dict[str, int]]] = []
        meta_path = root / split / "metadata.json"
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
        for item in payload.get("items", []):
            tensor_path = Path(item["tensor"])
            label_raw = str(item["label"]).lower()
            # Se espera label compuesto: study__region__finding
            parts = label_raw.split("__")
            if len(parts) != 3:
                continue
            study, region, findings = parts
            if study not in LABEL_MAP["study_type"] or region not in LABEL_MAP["region"] or findings not in LABEL_MAP["findings"]:
                continue
            self.samples.append(
                (
                    tensor_path,
                    {
                        "study_type": LABEL_MAP["study_type"][study],
                        "region": LABEL_MAP["region"][region],
                        "findings": LABEL_MAP["findings"][findings],
                    },
                )
            )

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        path, labels = self.samples[index]
        x = torch.load(path)
        return x, labels


def collate_fn(batch):
    xs = torch.stack([item[0] for item in batch], dim=0)
    study = torch.tensor([item[1]["study_type"] for item in batch], dtype=torch.long)
    region = torch.tensor([item[1]["region"] for item in batch], dtype=torch.long)
    findings = torch.tensor([item[1]["findings"] for item in batch], dtype=torch.long)
    return xs, study, region, findings


def train_epoch(model, loader, optimizer, device):
    model.train()
    total_loss = 0.0
    for x, y_study, y_region, y_findings in loader:
        x = x.to(device)
        y_study = y_study.to(device)
        y_region = y_region.to(device)
        y_findings = y_findings.to(device)

        logits = model(x)
        loss = (
            F.cross_entropy(logits["study_logits"], y_study)
            + F.cross_entropy(logits["region_logits"], y_region)
            + F.cross_entropy(logits["findings_logits"], y_findings)
        )

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        total_loss += float(loss.item())

    return total_loss / max(len(loader), 1)


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    truth_study: List[int] = []
    pred_study: List[int] = []
    truth_region: List[int] = []
    pred_region: List[int] = []
    truth_findings: List[int] = []
    pred_findings: List[int] = []

    for x, y_study, y_region, y_findings in loader:
        x = x.to(device)
        logits = model(x)

        pred_study.extend(torch.argmax(logits["study_logits"], dim=1).cpu().numpy().tolist())
        pred_region.extend(torch.argmax(logits["region_logits"], dim=1).cpu().numpy().tolist())
        pred_findings.extend(torch.argmax(logits["findings_logits"], dim=1).cpu().numpy().tolist())
        truth_study.extend(y_study.numpy().tolist())
        truth_region.extend(y_region.numpy().tolist())
        truth_findings.extend(y_findings.numpy().tolist())

    metrics = {}
    for name, y_true, y_pred in [
        ("study", truth_study, pred_study),
        ("region", truth_region, pred_region),
        ("findings", truth_findings, pred_findings),
    ]:
        metrics[f"{name}_accuracy"] = float(accuracy_score(y_true, y_pred)) if y_true else 0.0
        metrics[f"{name}_f1"] = float(f1_score(y_true, y_pred, average="macro")) if y_true else 0.0

    metrics["global_accuracy"] = float(np.mean([metrics["study_accuracy"], metrics["region_accuracy"], metrics["findings_accuracy"]]))
    metrics["global_f1"] = float(np.mean([metrics["study_f1"], metrics["region_f1"], metrics["findings_f1"]]))
    return metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Entrenamiento DL para imagen medica")
    parser.add_argument("--data", default="data/processed", type=str)
    parser.add_argument("--epochs", default=10, type=int)
    parser.add_argument("--batch-size", default=16, type=int)
    parser.add_argument("--lr", default=1e-4, type=float)
    parser.add_argument("--model-out", default="models/medical_model.pt", type=str)
    parser.add_argument("--metrics-out", default="models/medical_metrics.json", type=str)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_root = Path(args.data)
    model_out = Path(args.model_out)
    metrics_out = Path(args.metrics_out)
    model_out.parent.mkdir(parents=True, exist_ok=True)

    train_ds = ProcessedTensorDataset(data_root, "train")
    val_ds = ProcessedTensorDataset(data_root, "val")
    test_ds = ProcessedTensorDataset(data_root, "test")

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, collate_fn=collate_fn)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, collate_fn=collate_fn)
    test_loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False, collate_fn=collate_fn)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_default_model().to(device)
    optimizer = Adam(model.parameters(), lr=args.lr)

    best_val = -1.0
    for epoch in range(args.epochs):
        loss = train_epoch(model, train_loader, optimizer, device)
        val_metrics = evaluate(model, val_loader, device)
        if val_metrics["global_accuracy"] > best_val:
            best_val = val_metrics["global_accuracy"]
            torch.save(model.state_dict(), model_out)
        print(json.dumps({"epoch": epoch + 1, "loss": loss, **val_metrics}, ensure_ascii=True))

    model.load_state_dict(torch.load(model_out, map_location=device))
    test_metrics = evaluate(model, test_loader, device)
    accepted = test_metrics["global_accuracy"] >= 0.70

    metrics_payload = {
        "accepted": accepted,
        "threshold": 0.70,
        "test_metrics": test_metrics,
    }
    metrics_out.write_text(json.dumps(metrics_payload, ensure_ascii=True, indent=2), encoding="utf-8")
    print(json.dumps(metrics_payload, ensure_ascii=True))


if __name__ == "__main__":
    main()
