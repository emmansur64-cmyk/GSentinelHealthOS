# MetaBrain ML - Features Contextuales

## Visión General

El modelo ML ahora utiliza **18 features contextuales** que capturan:
- Características temporales
- Historial de incidentes
- Efectividad de acciones previas
- Contexto del sistema

## Categorías de Features

### 1. Características Temporales (3 features)

| Feature | Tipo | Descripción |
|---------|------|-------------|
| `hour_of_day` | int [0-23] | Hora del evento (para patrones por hora) |
| `day_of_week` | int [0-6] | Día de la semana (para patrones cíclicos) |
| `time_since_last_min` | float | Minutos desde el evento anterior (patrón de recurrencia) |

### 2. Historial de Incidentes (2 features)

| Feature | Tipo | Descripción |
|---------|------|-------------|
| `frequency_1h` | int | Num. incidentes del mismo tipo en última 1 hora |
| `frequency_1d` | int | Num. incidentes del mismo tipo en último 1 día |

**Interpretación**: Alta frecuencia = problema recurrente → acción más agresiva

### 3. Contexto de Datos (4 features)

| Feature | Tipo | Descripción |
|---------|------|-------------|
| `logs_count` | int | Cantidad de logs disponibles |
| `metrics_count` | int | Cantidad de métricas disponibles |
| `has_data` | [0,1] | ¿Hay datos contextuales? |
| `source_category` | str (encoded) | Categoría del origen (test, api, db, etc.) |

**Interpretación**: Más datos = mejor contexto → más confianza en acción

### 4. Historial de Acciones (2 features)

| Feature | Tipo | Descripción |
|---------|------|-------------|
| `action_historical_success_rate` | float [0-1] | Porcentaje de éxito histórico de la acción |
| `type_action_success_rate` | float [0-1] | Porcentaje de éxito para (tipo_incidente + acción) |

**Interpretación**: 
- 0.9 = acción ha funcionado bien antes
- 0.3 = acción frecuentemente falla
- 0.5 = datos insuficientes

### 5. Clasificación (8 features - encoded)

| Feature | Valores | Descripción |
|---------|---------|-------------|
| `incident_type` | {db timeout, error, ...} | Tipo de incidente |
| `source` | {test, api, system, ...} | Origen del evento |
| `original_type` | {system.error, ...} | Tipo original del evento |
| `diagnosis_code` | {TRANSIENT, CRITICAL, ...} | Código de diagnóstico |
| `strategy` | {booking, schedule, error} | Estrategia de Brain |
| `severity` | {low, medium, high, critical} | Severidad calculada dinámicamente |
| `action_type` | {BUSINESS, SYSTEM, ...} | Tipo de acción |
| `source_category` | {test, api, db, ...} | Categoría del origen |

**Cálculo de Severidad**:
```python
score = 0
if 'CRITICAL' in diagnosis: score += 3
elif 'TRANSIENT' in diagnosis: score += 1
else: score += 2
if 'error' in incident: score += 2
elif 'timeout' in incident: score += 1
score += frecuencia_1h / 2
```

## Flujo de Feature Engineering

```
Raw Incidents
    ↓
[Temporal Features] → hour, day, time_since_last
    ↓
[Frequency Analysis] → frequency_1h, frequency_1d
    ↓
[Historical Success Rates] → action_success, type_action_success
    ↓
[Context Calculation] → severity, logs_count, metrics_count
    ↓
[Encoding] → All categorical → numeric
    ↓
18-Feature Vector → ML Model
```

## Ejemplo de Predicción

**Incidente Real**:
```
- Tipo: "db timeout"
- Hora: 15 (3 PM)
- Día: 2 (miércoles)
- Tiempo desde último: 5 minutos
- Frecuencia 1h: 4 eventos similares
- Frecuencia 1d: 12 eventos similares
- Éxito prev de "retry_with_backoff": 85%
- Para este tipo + acción: 90%
- Logs disponibles: 3
- Severidad: high (recurrente + frecuente)
```

**Features resultantes**:
```
[15, 2, 5, 4, 12, 3, 0, 2, ..., 0.85, 0.90, 1, 2, 1, 3, ...]
```

**Decisión ML**: 
- Confianza: 0.92 (alta porque historia es buena)
- Acción: retry_with_backoff (experiencia probada)

## Mejoras vs Versión Anterior

| Aspecto | Antes | Ahora | Ganancia |
|---------|-------|-------|----------|
| Total Features | 14 | 18 | +28% |
| Temporal | 2 | 3 | contexto temporal |
| Histórico | 1 | 4 | + frecuencia + acciones |
| Contexto | 7 | 8 | + source_category |
| Éxito Previo | 0 | 2 | datos reales |

## Preparación para Producción

### Datos Requeridos
Para que el modelo funcioneque bien en production, se recomienda:

1. **Mínimo 100 incidentes** históricos
2. **Variedad de tipos** (al menos 5-10 tipos diferentes)
3. **Histórico de 30 días** para patrones confiables

### Monitoreo

Observar regularmente:
```
- action_historical_success_rate por acción
- frequency_1h / frequency_1d para alertas
- Drift en severidad detectada
```

### Reentrenamiento SLA

```
Diario: Cross-validation + métricas
Semanal: Evaluar feature importance
Mensual: Buscar nuevas features o cambios en patrones
```

## Feature Importance (RFC)

Esperado (cuando datos crezcan):
1. `action_historical_success_rate` (70%)
2. `frequency_1h` (15%)
3. `type_action_success_rate` (10%)
4. Otros (5%)

La historia de éxito es el predictor más fuerte.

### Nota sobre Dataset Pequeño

Con dataset muy pequeño (1-2 muestras por clase):
- RFC alcanza 100% accuracy sin usar features
- Feature importance = 0% para todas
- Esto es normal y esperado

**Cuando escales a 100+ incidentes**, verás:
- `action_historical_success_rate` dominante
- `frequency_*` features activos
- Categorical features contribuyendo en decisiones
- Mejor generalization en test set

## Validación de Features en Producción

Script para usar (después de actualizar datos):
```bash
python scripts/analyze_features.py
```

Salida esperada:
```
action_historical_success_rate  45.2% ██████████████████████░░
frequency_1h                    18.3% █████████░░░░░░░░░░░░░░
type_action_success_rate        16.7% ████████░░░░░░░░░░░░░░░
...
```

Si ves feature importance desbalanceada (e.g., 1 feature > 90%):
→ Sobreajuste o feature redundante
→ Considerar feature selection
