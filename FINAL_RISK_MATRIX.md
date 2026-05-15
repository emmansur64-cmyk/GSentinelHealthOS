# FINAL RISK MATRIX

| Riesgo | Severidad | Probabilidad | Readiness | Mitigacion |
| --- | --- | --- | --- | --- |
| Activacion accidental IA | Alta | Media | Media | Kill switch global, flags apagados |
| PHI a provider externo | Critica | Media | Media-baja | PHI flags false, sanitizer, policy futura |
| Diagnostico definitivo accidental | Critica | Baja-media | Media | Safety model, human review, no enforcement |
| Multimodal inseguro | Critica | Media | Baja | Vision/DICOM apagados, review requerida |
| Vector memory contaminada | Alta | Media | Baja | Vector/write/patient scope apagados |
| Observability con PHI | Alta | Media | Media | Export/PHI apagados, sanitizers |
| Provider divergence | Alta | Media | Media | Confidence provider consistency futura |
| Human review sin persistencia | Media | Alta | Baja | Requiere DB/UI futura |
| Runtime integration rompe compatibilidad | Alta | Media | Baja | Roadmap shadow, rollback por capa |
| Flags inconsistentes | Media | Alta | Media | Normalizar registry antes de runtime |
| Overhead operacional | Media | Media | Baja | Medir en shadow antes de activar |
| Falsa confianza clinica | Critica | Media | Media | Explicabilidad y disclaimers de no certeza |

## Riesgo residual

El riesgo residual es aceptable solo porque las capas nuevas no estan conectadas y los defaults son seguros.
