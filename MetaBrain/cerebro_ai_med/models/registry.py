from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SEMVER_PATTERN = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][A-Za-z0-9.-]+)?$")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def compute_sha256(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_semver(version: str) -> str:
    normalized = version.strip()
    if not SEMVER_PATTERN.match(normalized):
        raise RuntimeError(f"invalid_model_version: {version}")
    return normalized


@dataclass(frozen=True)
class ArtifactRef:
    path: Path
    sha256: str


@dataclass(frozen=True)
class ActiveModelSpec:
    version: str
    model_family: str
    labels: list[str]
    text_artifact: ArtifactRef
    image_artifact: ArtifactRef
    metrics: dict[str, Any]


def _semver_key(version: str) -> tuple[int, int, int]:
    core = version.split("-", 1)[0].split("+", 1)[0]
    major, minor, patch = core.split(".")
    return int(major), int(minor), int(patch)


def _resolve_artifact_path(raw_path: str, metadata_path: Path) -> Path:
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = (metadata_path.parent / candidate).resolve()
    else:
        candidate = candidate.resolve()

    allowed_root = metadata_path.parent.resolve()
    if allowed_root not in candidate.parents:
        raise RuntimeError("artifact_path_outside_registry_root")
    return candidate


def _build_spec_from_entry(entry: dict[str, Any], metadata_path: Path) -> ActiveModelSpec:
    version = ensure_semver(str(entry.get("version", "")))
    artifacts = entry.get("artifacts", {})
    text = artifacts.get("text", {})
    image = artifacts.get("image", {})

    text_path = _resolve_artifact_path(str(text.get("path", "")), metadata_path)
    image_path = _resolve_artifact_path(str(image.get("path", "")), metadata_path)
    if not text_path.exists() or not image_path.exists():
        raise RuntimeError("active_model_artifact_missing")

    expected_text_sha = str(text.get("sha256", "")).strip().lower()
    expected_image_sha = str(image.get("sha256", "")).strip().lower()
    if not expected_text_sha or not expected_image_sha:
        raise RuntimeError("artifact_checksum_missing")

    if compute_sha256(text_path) != expected_text_sha:
        raise RuntimeError("text_artifact_checksum_mismatch")
    if compute_sha256(image_path) != expected_image_sha:
        raise RuntimeError("image_artifact_checksum_mismatch")

    labels = entry.get("labels", ["low", "medium", "high"])
    if not isinstance(labels, list):
        labels = ["low", "medium", "high"]

    return ActiveModelSpec(
        version=version,
        model_family=str(entry.get("model_family", "sklearn-logistic-regression")),
        labels=[str(label) for label in labels],
        text_artifact=ArtifactRef(path=text_path, sha256=expected_text_sha),
        image_artifact=ArtifactRef(path=image_path, sha256=expected_image_sha),
        metrics=entry.get("metrics", {}),
    )


def parse_active_spec(metadata_path: Path) -> ActiveModelSpec:
    if not metadata_path.exists():
        raise RuntimeError(f"registry_not_found: {metadata_path}")

    raw = json.loads(metadata_path.read_text(encoding="utf-8"))
    active_version = ensure_semver(str(raw.get("active_model", "")))
    models = raw.get("models", [])
    if not isinstance(models, list) or not models:
        raise RuntimeError("registry_has_no_models")

    active = None
    for item in models:
        if str(item.get("version", "")).strip() == active_version:
            active = item
            break
    if active is None:
        raise RuntimeError(f"active_model_not_found: {active_version}")

    return _build_spec_from_entry(active, metadata_path)


def parse_best_fallback_spec(metadata_path: Path, failed_version: str) -> ActiveModelSpec:
    if not metadata_path.exists():
        raise RuntimeError(f"registry_not_found: {metadata_path}")

    raw = json.loads(metadata_path.read_text(encoding="utf-8"))
    models = raw.get("models", [])
    if not isinstance(models, list) or not models:
        raise RuntimeError("registry_has_no_models")

    candidates: list[dict[str, Any]] = []
    for item in models:
        version = str(item.get("version", "")).strip()
        if version == failed_version:
            continue
        try:
            ensure_semver(version)
            candidates.append(item)
        except RuntimeError:
            continue

    candidates.sort(key=lambda x: _semver_key(str(x.get("version", "0.0.0"))), reverse=True)

    for candidate in candidates:
        try:
            return _build_spec_from_entry(candidate, metadata_path)
        except RuntimeError:
            continue

    raise RuntimeError("no_fallback_model_available")
