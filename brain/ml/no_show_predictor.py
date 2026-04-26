"""Prediccion de no-show para el Brain worker.

Motor deterministico con soporte ONNX Runtime y fallback heuristico.
No depende de servicios externos.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from brain.core.config import settings
from shared.utils import setup_logger

logger = setup_logger(__name__)


try:
    import onnxruntime as ort
except Exception:  # pragma: no cover - se cubre por fallback
    ort = None


_DEFAULT_BASELINE = 0.18
_EPS = 1e-9


@dataclass(slots=True)
class NoShowFeatures:
    patient_no_show_rate: float
    doctor_no_show_rate: float
    specialty_no_show_rate: float
    lead_time_norm: float
    is_weekend: float
    is_morning: float
    is_night: float
    is_confirmed: float

    def as_numpy(self) -> np.ndarray:
        return np.array(
            [
                self.patient_no_show_rate,
                self.doctor_no_show_rate,
                self.specialty_no_show_rate,
                self.lead_time_norm,
                self.is_weekend,
                self.is_morning,
                self.is_night,
                self.is_confirmed,
            ],
            dtype=np.float32,
        ).reshape(1, 8)


class NoShowPredictor:
    """Predictor ONNX de probabilidad de ausentismo."""

    def __init__(self, model_path: str | None = None) -> None:
        self._model_path = Path(model_path or settings.no_show_model_path)
        self._session: Any = None
        self._model_unavailable = False

    def predict(
        self,
        *,
        patient_history: list[dict[str, Any]],
        age: int | None,
        previous_cancellations: int,
        appointment_at: datetime,
        created_at: datetime | None = None,
        is_confirmed: bool = False,
    ) -> dict[str, float]:
        """Retorna la probabilidad de no-show entre 0.01 y 0.99."""
        created_at = created_at or datetime.now(UTC)
        features = self._build_features(
            patient_history=patient_history,
            appointment_at=appointment_at,
            created_at=created_at,
            is_confirmed=is_confirmed,
        )

        p = self._infer_with_onnx(features)
        if p is None:
            p = self._infer_with_fallback(features)

        # Ajustes deterministas solicitados para edad y cancelaciones previas.
        p = self._adjust_with_age_and_cancellations(
            probability=p,
            age=age,
            previous_cancellations=previous_cancellations,
        )

        return {"no_show_probability": round(self._clamp(p), 4)}

    def _load_session(self) -> Any:
        if self._session is not None or self._model_unavailable:
            return self._session

        if ort is None:
            logger.warning("onnxruntime no disponible; usando fallback heuristico")
            self._model_unavailable = True
            return None

        if not self._model_path.exists():
            logger.warning("Modelo no-show ONNX no encontrado en %s", self._model_path)
            self._model_unavailable = True
            return None

        try:
            self._session = ort.InferenceSession(str(self._model_path))
            logger.info("Modelo no-show ONNX cargado desde %s", self._model_path)
        except Exception as exc:  # pragma: no cover
            logger.error("Error cargando modelo ONNX de no-show: %s", exc)
            self._model_unavailable = True
            self._session = None
        return self._session

    def _infer_with_onnx(self, features: NoShowFeatures) -> float | None:
        session = self._load_session()
        if session is None:
            return None

        try:
            input_tensor = features.as_numpy()
            feeds = {"float_input": input_tensor}
            results = session.run(None, feeds)

            # salida esperada: tensor [1,2] con indice 1 = no_show
            for output in results:
                arr = np.asarray(output).reshape(-1)
                if arr.size >= 2:
                    return float(arr[1])
            return None
        except Exception as exc:  # pragma: no cover
            logger.error("Error durante inferencia ONNX no-show: %s", exc)
            return None

    def _infer_with_fallback(self, features: NoShowFeatures) -> float:
        # Heuristica logistica determinista cuando no hay modelo ONNX.
        z = (
            -1.45
            + 2.20 * features.patient_no_show_rate
            + 1.20 * features.doctor_no_show_rate
            + 0.80 * features.specialty_no_show_rate
            + 0.40 * (1.0 - features.lead_time_norm)
            + 0.12 * features.is_weekend
            + 0.08 * features.is_night
            - 0.10 * features.is_confirmed
        )
        return 1.0 / (1.0 + np.exp(-z))

    @staticmethod
    def _adjust_with_age_and_cancellations(
        *,
        probability: float,
        age: int | None,
        previous_cancellations: int,
    ) -> float:
        p = probability

        if age is not None:
            if age < 21:
                p += 0.04
            elif age > 75:
                p += 0.05

        if previous_cancellations > 0:
            p += min(previous_cancellations, 8) * 0.02

        return p

    @staticmethod
    def _status_is_no_show(status: str) -> bool:
        s = (status or "").strip().lower()
        return s in {"no_show", "noshow", "no-show"}

    @staticmethod
    def _clamp(value: float, low: float = 0.01, high: float = 0.99) -> float:
        if value < low:
            return low
        if value > high:
            return high
        return value

    def _build_features(
        self,
        *,
        patient_history: list[dict[str, Any]],
        appointment_at: datetime,
        created_at: datetime,
        is_confirmed: bool,
    ) -> NoShowFeatures:
        statuses = [str(item.get("status", "")).strip().lower() for item in patient_history]

        total_labeled = sum(1 for s in statuses if s in {"completed", "cancelled", "no_show", "noshow", "no-show"})
        total_no_show = sum(1 for s in statuses if self._status_is_no_show(s))

        patient_rate = (
            total_no_show / (total_labeled + _EPS)
            if total_labeled > 0
            else _DEFAULT_BASELINE
        )

        # En Brain no tenemos score por doctor/especialidad en este endpoint.
        # Mantener paridad de dimensiones con el modelo ONNX reutilizando baseline.
        doctor_rate = patient_rate
        specialty_rate = patient_rate

        lead_days = max((appointment_at - created_at).total_seconds() / 86400.0, 0.0)
        lead_norm = min(lead_days / 45.0, 1.0)

        weekday = appointment_at.weekday()  # 0=lunes ... 6=domingo
        is_weekend = 1.0 if weekday >= 5 else 0.0
        is_morning = 1.0 if appointment_at.hour < 12 else 0.0
        is_night = 1.0 if appointment_at.hour >= 18 else 0.0

        return NoShowFeatures(
            patient_no_show_rate=float(self._clamp(patient_rate, 0.01, 0.95)),
            doctor_no_show_rate=float(self._clamp(doctor_rate, 0.01, 0.95)),
            specialty_no_show_rate=float(self._clamp(specialty_rate, 0.01, 0.95)),
            lead_time_norm=float(self._clamp(lead_norm, 0.0, 1.0)),
            is_weekend=is_weekend,
            is_morning=is_morning,
            is_night=is_night,
            is_confirmed=1.0 if is_confirmed else 0.0,
        )


predictor = NoShowPredictor()
