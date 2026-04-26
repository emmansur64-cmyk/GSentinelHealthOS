#!/usr/bin/env python3
"""
Entrena un modelo GradientBoosting para predicción de ausentismo (no-show).
Exporta el modelo como ONNX a models/no_show_model.onnx.

Uso:
  python scripts/train_no_show_model.py \\
    --db "postgresql://user:pass@localhost:5432/dbname"

  # O con variable de entorno:
  DATABASE_URL=postgresql://... python scripts/train_no_show_model.py

Dependencias (instalar antes):
  pip install scikit-learn numpy skl2onnx onnx psycopg[binary]

El vector de features (8 variables float32) coincide EXACTAMENTE con el que
usa onnx-inference.ts durante la inferencia en producción:
  [patient_no_show_rate, doctor_no_show_rate, specialty_no_show_rate,
   lead_time_norm, is_weekend, is_morning, is_night, is_confirmed]

NOTA: Los entity rates se calculan sobre la ventana completa (180 días).
Esto introduce leakage mínimo aceptable para v1. Para v2 usar
leave-one-out temporal encoding.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

try:
    import psycopg
except ImportError:
    print("ERROR: pip install psycopg[binary]", file=sys.stderr)
    sys.exit(1)

try:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.metrics import brier_score_loss, roc_auc_score
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
except ImportError:
    print("ERROR: pip install scikit-learn", file=sys.stderr)
    sys.exit(1)

try:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
except ImportError:
    print("ERROR: pip install skl2onnx onnx", file=sys.stderr)
    sys.exit(1)


FEATURE_NAMES = [
    "patient_no_show_rate",
    "doctor_no_show_rate",
    "specialty_no_show_rate",
    "lead_time_norm",
    "is_weekend",
    "is_morning",
    "is_night",
    "is_confirmed",
]

TRAINING_SQL = """
WITH base AS (
    SELECT
        a.id,
        a.patient_id::text,
        a.doctor_id::text,
        d.specialty,
        a.status,
        a.datetime,
        a.created_at
    FROM appointments a
    INNER JOIN doctor_profiles d ON d.user_id = a.doctor_id
    WHERE a.deleted_at IS NULL
      AND a.status IN ('completed', 'no_show')
      AND a.datetime >= NOW() - INTERVAL '180 days'
),
patient_rates AS (
    SELECT
        patient_id,
        COALESCE(
            SUM(CASE WHEN status = 'no_show' THEN 1.0 ELSE 0.0 END) /
            NULLIF(COUNT(*)::double precision, 0),
            0.18
        ) AS patient_no_show_rate
    FROM base
    GROUP BY patient_id
),
doctor_rates AS (
    SELECT
        doctor_id,
        COALESCE(
            SUM(CASE WHEN status = 'no_show' THEN 1.0 ELSE 0.0 END) /
            NULLIF(COUNT(*)::double precision, 0),
            0.18
        ) AS doctor_no_show_rate
    FROM base
    GROUP BY doctor_id
),
specialty_rates AS (
    SELECT
        specialty,
        COALESCE(
            SUM(CASE WHEN status = 'no_show' THEN 1.0 ELSE 0.0 END) /
            NULLIF(COUNT(*)::double precision, 0),
            0.18
        ) AS specialty_no_show_rate
    FROM base
    GROUP BY specialty
)
SELECT
    GREATEST(LEAST(COALESCE(pr.patient_no_show_rate, 0.18), 0.95), 0.01)  AS patient_no_show_rate,
    GREATEST(LEAST(COALESCE(dr.doctor_no_show_rate, 0.18), 0.95), 0.01)  AS doctor_no_show_rate,
    GREATEST(LEAST(COALESCE(sr.specialty_no_show_rate, 0.18), 0.95), 0.01) AS specialty_no_show_rate,
    LEAST(
        GREATEST(EXTRACT(EPOCH FROM (b.datetime - b.created_at)) / 86400.0, 0.0) / 45.0,
        1.0
    )::double precision AS lead_time_norm,
    CASE WHEN EXTRACT(DOW FROM b.datetime) IN (0, 6) THEN 1.0 ELSE 0.0 END AS is_weekend,
    CASE WHEN EXTRACT(HOUR FROM b.datetime) < 12 THEN 1.0 ELSE 0.0 END AS is_morning,
    CASE WHEN EXTRACT(HOUR FROM b.datetime) >= 18 THEN 1.0 ELSE 0.0 END AS is_night,
    0.0 AS is_confirmed,
    CASE WHEN b.status = 'no_show' THEN 1 ELSE 0 END AS label
FROM base b
LEFT JOIN patient_rates  pr USING (patient_id)
LEFT JOIN doctor_rates   dr USING (doctor_id)
LEFT JOIN specialty_rates sr USING (specialty)
LIMIT 100000
"""


def fetch_dataset(conn_str: str) -> tuple[np.ndarray, np.ndarray]:
    print("Conectando a la base de datos...")
    with psycopg.connect(conn_str) as conn:
        with conn.cursor() as cur:
            cur.execute(TRAINING_SQL)
            rows = cur.fetchall()

    if not rows:
        raise RuntimeError(
            "No se encontraron datos de entrenamiento. "
            "Requiere turnos con status 'completed' o 'no_show' en los últimos 180 días."
        )

    arr = np.array(rows, dtype=np.float32)
    X = arr[:, :-1]   # 8 features
    y = arr[:, -1].astype(np.int32)
    return X, y


def train_and_export(X: np.ndarray, y: np.ndarray, output_path: Path) -> dict:
    n_total = len(X)
    n_noshow = int(y.sum())
    noshow_rate = float(y.mean())
    print(f"Dataset: {n_total:,} muestras — {n_noshow:,} no-shows ({100 * noshow_rate:.1f}%)")

    if n_total < 200:
        print("ADVERTENCIA: Dataset muy pequeño (<200 muestras). Los resultados pueden no ser confiables.")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if n_noshow >= 10 else None
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", GradientBoostingClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            min_samples_leaf=20,
            random_state=42,
        )),
    ])

    print("Entrenando GradientBoostingClassifier...")
    pipeline.fit(X_train, y_train)

    proba_test = pipeline.predict_proba(X_test)[:, 1]
    auc = float(roc_auc_score(y_test, proba_test))
    brier = float(brier_score_loss(y_test, proba_test))
    print(f"  AUC-ROC:     {auc:.4f}")
    print(f"  Brier score: {brier:.4f}  (menor = mejor; heurística ≈ 0.14)")

    # Exportar a ONNX — zipmap=False produce tensor float32 [N,2] en vez de mapa
    print("Exportando a ONNX...")
    initial_type = [("float_input", FloatTensorType([None, X.shape[1]]))]
    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_type,
        options={GradientBoostingClassifier: {"zipmap": False}},
        target_opset=17,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"Modelo guardado: {output_path}  ({output_path.stat().st_size // 1024} KB)")

    metadata = {
        "model_version": "onnx-gbm-v1",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_samples": n_total,
        "n_noshow": n_noshow,
        "noshow_rate": noshow_rate,
        "auc_roc": auc,
        "brier_score": brier,
        "feature_names": FEATURE_NAMES,
        "n_features": len(FEATURE_NAMES),
    }

    meta_path = output_path.with_suffix(".json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadatos guardados: {meta_path}")

    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Entrena el modelo ONNX de predicción de ausentismo.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--db",
        default=os.environ.get("DATABASE_URL", ""),
        help="PostgreSQL DSN. También acepta la variable de entorno DATABASE_URL.",
    )
    default_output = str(
        Path(__file__).resolve().parent.parent / "models" / "no_show_model.onnx"
    )
    parser.add_argument(
        "--output",
        default=default_output,
        help=f"Ruta de salida del modelo ONNX (default: {default_output})",
    )
    args = parser.parse_args()

    if not args.db:
        parser.error("Se requiere --db o la variable de entorno DATABASE_URL")

    print("=" * 60)
    print(" Entrenamiento: Modelo de Predicción de Ausentismo (ONNX)")
    print("=" * 60)

    X, y = fetch_dataset(args.db)
    metadata = train_and_export(X, y, Path(args.output))

    print()
    print("=" * 60)
    print(f" Completado  |  AUC={metadata['auc_roc']:.4f}  |  Brier={metadata['brier_score']:.4f}")
    print("=" * 60)
    print()
    print("Próximo paso: reiniciar el servidor Next.js para cargar el nuevo modelo.")


if __name__ == "__main__":
    main()
