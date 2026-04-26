# Quick Start: Enriched ML Features

## ¿Qué Cambió?

El dataset de entrenamiento pasó de **10 features simples** a **37 features avanzadas**:

- ✗ Antes: `hour_of_day`, `day_of_week`, 8 features categóricas
- ✓ Ahora: 12 temporales, 10 históricas, 6 contexto, 4 comportamiento, 9 categóricas

**Resultado esperado:** Mejor generalización, menor overfitting, decisiones más inteligentes.

---

## Guía Rápida

### 1. Generar Dataset Enriquecido

```bash
# Genera 37 features desde incidents.json, outcomes.json, audit.json
python scripts/data_pipeline.py
```

**Salida:**
```
X_train.csv          → 37 features × train samples
X_test.csv           → 37 features × test samples
y_train.csv, y_test.csv → Labels
feature_names.txt    → Lista de features
```

### 2. Analizar Features

```bash
# Muestra importancia, correlaciones, calidad de datos
python scripts/analyze_features.py
```

**Output:** Qué features son útiles, correlaciones, estadísticas.

### 3. Entrenar Modelo

```bash
# Entrena RandomForest con los 37 features
python scripts/train_model.py
```

### 4. Validar

```bash
# Verifica overfitting, accuracy, readiness score
python scripts/validate_model.py

# Monitorea en producción
python scripts/model_monitor.py
```

---

## Feature Categories

### Temporal Avanzadas (12)
Detecta patrones horarios, diarios, explosiones de incidentes:
```
hour_of_day, day_of_week, day_of_month, month
time_since_last_min, time_since_last_normalized
incidents_last_1h, incidents_last_24h, incidents_last_7d
incidents_1h_normalized, incidents_24h_normalized, incidents_7d_normalized
rolling_frequency
```

### Históricas (10)
Aprende del pasado - qué ha funcionado/fallado:
```
last_action_taken, last_action_success
success_rate_last_10, failure_rate_last_10, success_rate_today
action_historical_success_rate, type_action_success_rate
retry_count_1h, retry_count_normalized
action_effectiveness_score
```

### Contexto (6)
Señales de disponibilidad de datos y riesgo:
```
logs_count, metrics_count, has_data
logs_count_normalized, metrics_count_normalized
severity (inferred from diagnosis + type + frequency)
```

### Comportamiento (4)
Detecta escalación y degradación:
```
retry_count_1h, retry_count_normalized
escalation_flag, action_effectiveness_score
```

### Categóricas (9, encoded)
```
incident_type_encoded, source_encoded, original_type_encoded
diagnosis_code_encoded, strategy_encoded, severity_encoded
action_type_encoded, source_category_encoded, last_action_taken_encoded
```

---

## Ejemplo de Uso

### Cargar Features en Código

```python
import pandas as pd
import joblib

# Cargar datos
X_train = pd.read_csv('data/processed/X_train.csv')
y_train = pd.read_csv('data/processed/y_train.csv')

# Cargar feature names
with open('data/processed/feature_names.txt') as f:
    feature_names = [line.strip() for line in f]

# Cargar encoders (para categorías)
encoders = joblib.load('models/feature_encoders.pkl')
action_encoder = joblib.load('models/action_encoder.pkl')
scaler = joblib.load('models/feature_scaler.pkl')

# Tu modelo
from sklearn.ensemble import RandomForestClassifier
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train.values.ravel())

# Feature importance
importance = pd.DataFrame({
    'feature': feature_names,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False)

print(importance.head(10))
```

### Predicción con Nuevo Incidente

```python
# Crear nuevo incidente (raw)
new_incident = {
    'hour_of_day': 23,
    'day_of_week': 2,
    'day_of_month': 13,
    'month': 4,
    'time_since_last_min': 45.0,
    'incidents_last_1h': 2,
    'incidents_last_24h': 15,
    # ... más features calculadas de datos en vivo
}

# Crear DataFrame con order correcto
X_new = pd.DataFrame([new_incident])[feature_names]

# Predecir
prediction = model.predict(X_new)[0]
action = action_encoder.inverse_transform([prediction])[0]

print(f"Acción recomendada: {action}")
```

---

## Verificación Rápida

### ✓ Pasos para Validar

1. **Dataset generado:**
   ```bash
   ls data/processed/X_*.csv
   # Debe mostrar X_train.csv, X_test.csv, X_train_scaled.csv, X_test_scaled.csv
   ```

2. **Features count:**
   ```bash
   wc -l data/processed/feature_names.txt
   # Debe mostrar 37
   ```

3. **Null values:**
   ```bash
   python -c "import pandas as pd; df = pd.read_csv('data/processed/X_train.csv'); print(f'Nulls: {df.isnull().sum().sum()}')"
   # Debe mostrar 0
   ```

4. **Model training:**
   ```bash
   python scripts/train_model.py
   # Debe guardar models/decision_model.pkl (y .onnx)
   ```

---

## Performance Esperado

Con 37 features enriquecidas vs 10 originales:

| Métrica | Esperado |
|---------|----------|
| Test Accuracy | ≥70% |
| Overfitting | <15% gap |
| CV Stability | <20% std |
| Readiness Score | ≥60 |

**Nota:** Requiere suficiente data (100+ incidents) para validar.

---

## Troubleshooting

### Error: "No data extracted"
→ Verifica que `data/incidents.json` exista y tenga datos válidos

### Error: "Feature names mismatch"
→ Regenera: `python scripts/data_pipeline.py`

### Low accuracy después de generar features
→ Posible: datos insuficientes o clase muy balanceada
→ Solución: recolecta más datos o ajusta class_weight

### Modelos viejos incompatibles
→ Los nuevos 37 features requieren reentrenamiento
→ Re-ejecuta: `python scripts/train_model.py`

---

## Documentación Detallada

- [Feature Engineering Enriquecido](FEATURE_ENGINEERING_ENRICHED.md) - Arquitectura completa
- [ML Validation & Production](ML_VALIDATION_PRODUCTION.md) - Pipeline de validación
- [Data Pipeline](../scripts/data_pipeline.py) - Código fuente

---

## Próximos Pasos

1. ✓ Generar dataset: `python scripts/data_pipeline.py`
2. ✓ Analizar: `python scripts/analyze_features.py`
3. ✓ Entrenar: `python scripts/train_model.py`
4. ✓ Validar: `python scripts/validate_model.py`
5. ✓ Monitorear: `python scripts/model_monitor.py`

**Resultado:** Modelo de ML robusto, con features ricas, listo para producción.
