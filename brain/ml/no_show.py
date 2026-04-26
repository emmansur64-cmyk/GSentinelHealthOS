"""Interfaz simplificada para predicción de no-show.

``predict(data)`` es el punto de entrada público.  Delega en
``NoShowPredictor`` (ONNX + fallback heurístico) y devuelve directamente
la probabilidad como ``float`` entre 0.0 y 1.0.

Ejemplo::

    from brain.ml.no_show import predict

    prob = predict({
        "patient_history": [...],
        "age": 35,
        "previous_cancellations": 2,
        "appointment_at": datetime(...),
        "created_at": datetime(...),   # opcional
        "is_confirmed": False,         # opcional
    })
    # prob == 0.23  (float)
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from brain.ml.no_show_predictor import NoShowPredictor

_predictor = NoShowPredictor()


def predict(data: dict[str, Any]) -> float:
    """Retorna la probabilidad de no-show como float (0.0–1.0).

    Args:
        data: Diccionario con los campos:
            - ``patient_history`` (list[dict]): historial de turnos del paciente.
            - ``age`` (int | None): edad del paciente.
            - ``previous_cancellations`` (int): cantidad de cancelaciones previas.
            - ``appointment_at`` (datetime): fecha/hora del turno solicitado.
            - ``created_at`` (datetime, optional): momento de creación del turno.
            - ``is_confirmed`` (bool, optional): si el turno ya fue confirmado.

    Returns:
        Probabilidad de no-show entre 0.0 y 1.0.
    """
    result = _predictor.predict(
        patient_history=data.get("patient_history") or [],
        age=data.get("age"),
        previous_cancellations=int(data.get("previous_cancellations") or 0),
        appointment_at=data["appointment_at"],
        created_at=data.get("created_at"),
        is_confirmed=bool(data.get("is_confirmed", False)),
    )
    return float(result.get("no_show_probability", 0.0))


def is_critical_slot(appointment_at: datetime) -> bool:
    """True si el slot es considerado crítico (alta demanda, difícil de reasignar).

    Criterios de slot crítico:
    - Lunes a viernes (no finde de semana).
    - Franja horaria prime: 08:00–13:00 (mañana).
    """
    if appointment_at is None:
        return False
    weekday = appointment_at.weekday()  # 0=lunes … 6=domingo
    is_weekday = weekday < 5
    is_prime_hour = 8 <= appointment_at.hour < 13
    return is_weekday and is_prime_hour
