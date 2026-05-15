# GLOBAL AI FLAGS REFERENCE

| Flag | Default | Riesgo si se activa | Descripcion |
| --- | --- | --- | --- |
| `AI_RUNTIME_ENABLED` | `false` | Alto | Habilitaria runtime IA global futuro. |
| `AI_RUNTIME_SHADOW_MODE` | `true` | Bajo | Permite evaluacion paralela sin cambiar salida real. |
| `AI_RUNTIME_DRY_RUN` | `true` | Bajo | Evita efectos, escritura productiva y enforcement. |
| `AI_RUNTIME_KILL_SWITCH` | `true` | Bajo | Bloquea activacion IA aunque otros flags cambien. |
| `AI_RUNTIME_SAFE_FALLBACK` | `true` | Bajo | Devuelve control al flujo actual. |
| `AI_RUNTIME_BLOCKING_ENABLED` | `false` | Critico | Podria bloquear outputs si se conecta enforcement. |
| `SEMANTIC_MEMORY_ENABLED` | `false` | Alto | Activaria memoria semantica. |
| `SEMANTIC_MEMORY_SHADOW_MODE` | `true` | Bajo | Evalua memoria sin impacto real. |
| `SEMANTIC_MEMORY_VECTOR_ENABLED` | `false` | Alto | Activaria vector backend futuro. |
| `SEMANTIC_MEMORY_WRITE_ENABLED` | `false` | Alto | Permitiria escritura semantica. |
| `SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED` | `false` | Alto | Permitiria scope paciente. |
| `MEDICAL_VISION_ENABLED` | `false` | Critico | Activaria pipeline de vision medica futuro. |
| `MEDICAL_VISION_SHADOW_MODE` | `true` | Bajo | Vision en shadow futuro. |
| `MEDICAL_VISION_PROVIDER_ENABLED` | `false` | Critico | Permitiria provider visual. |
| `DICOM_ENABLED` | `false` | Critico | Activaria soporte DICOM futuro. |
| `DICOM_SHADOW_MODE` | `true` | Bajo | DICOM shadow futuro. |
| `IMAGE_HUMAN_REVIEW_REQUIRED` | `true` | Bajo | Requiere revision humana para imagen. |
| `IMAGE_STORE_ORIGINAL` | `false` | Critico | Podria almacenar imagen original. |
| `LLM_PROVIDER_ROUTER_ENABLED` | `false` | Alto | Activaria router provider. |
| `LLM_PROVIDER_SHADOW_MODE` | `true` | Bajo | Router en shadow futuro. |
| `LLM_PROVIDER_FALLBACK_ENABLED` | `false` | Medio | Activaria fallback provider controlado. |
| `LLM_PROVIDER_HEALTHCHECK_ENABLED` | `true` | Bajo | Healthcheck provider. |
| `LLM_PROVIDER_STRUCTURED_OUTPUT_ENABLED` | `false` | Medio | Activaria structured outputs. |
| `LLM_PROVIDER_MULTIMODAL_ENABLED` | `false` | Critico | Activaria multimodalidad. |
| `LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED` | `false` | Critico | Permitiria imagenes externas. |
| `LLM_PROVIDER_PHI_ALLOWED` | `false` | Critico | Permitiria PHI a providers. |
| `HUMAN_REVIEW_ENABLED` | `false` | Medio | Activaria review layer. |
| `HUMAN_REVIEW_SHADOW_MODE` | `true` | Bajo | Review en shadow. |
| `HUMAN_REVIEW_BLOCKING_ENABLED` | `false` | Critico | Podria bloquear outputs. |
| `HUMAN_REVIEW_IMAGE_REQUIRED` | `true` | Bajo | Exige revision para imagen. |
| `HUMAN_REVIEW_LOW_CONFIDENCE_REQUIRED` | `true` | Bajo | Exige review por baja confianza. |
| `HUMAN_REVIEW_MULTIMODAL_REQUIRED` | `true` | Bajo | Exige review multimodal. |
| `HUMAN_REVIEW_HIGH_RISK_REQUIRED` | `true` | Bajo | Exige review por alto riesgo. |
| `HUMAN_OVERRIDE_ENABLED` | `false` | Alto | Permitiria override humano. |
| `CLINICAL_CONFIDENCE_ENABLED` | `false` | Medio | Activaria motor de confianza. |
| `CLINICAL_CONFIDENCE_SHADOW_MODE` | `true` | Bajo | Confianza en shadow. |
| `CLINICAL_CONFIDENCE_BLOCKING_ENABLED` | `false` | Critico | Podria bloquear por confianza. |
| `CLINICAL_CONFIDENCE_MULTIMODAL_ENABLED` | `false` | Alto | Evalua conflictos multimodales. |
| `CLINICAL_CONFIDENCE_PROVIDER_CONSISTENCY_ENABLED` | `true` | Bajo | Evalua consistencia provider. |
| `CLINICAL_CONFIDENCE_HALLUCINATION_CHECK_ENABLED` | `true` | Bajo | Estima riesgo de hallucination. |
| `CLINICAL_CONFIDENCE_SAFE_DISPLAY_ENABLED` | `false` | Alto | Evaluaria safe display. |
| `CLINICAL_CONFIDENCE_AUTO_ESCALATION_ENABLED` | `false` | Alto | Escalacion automatica futura. |
| `OBSERVABILITY_ENABLED` | `false` | Medio | Activaria observabilidad futura. |
| `OBSERVABILITY_SHADOW_MODE` | `true` | Bajo | Observabilidad en shadow. |
| `OBSERVABILITY_STRUCTURED_LOGGING_ENABLED` | `false` | Medio | Activaria structured logging. |
| `OBSERVABILITY_TRACE_ENGINE_ENABLED` | `false` | Medio | Activaria trace engine. |
| `OBSERVABILITY_PROVIDER_METRICS_ENABLED` | `false` | Bajo | Metric contracts provider. |
| `OBSERVABILITY_CONFIDENCE_METRICS_ENABLED` | `false` | Bajo | Metric contracts confidence. |
| `OBSERVABILITY_REVIEW_METRICS_ENABLED` | `false` | Bajo | Metric contracts review. |
| `OBSERVABILITY_MULTIMODAL_METRICS_ENABLED` | `false` | Medio | Metric contracts multimodal. |
| `OBSERVABILITY_EXTERNAL_EXPORT_ENABLED` | `false` | Critico | Exportaria telemetry externa. |
| `OBSERVABILITY_PHI_ALLOWED` | `false` | Critico | Permitiria PHI en telemetry. |
