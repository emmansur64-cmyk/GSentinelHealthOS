# NEXT SAFE BATCH CLASSIFICATION

Fecha: 2026-05-12
Repositorio: GSentinelHealthOS
Branch: GsentinelH

## 1) Inventario resumido

Estado global del worktree:
- Modified: 60
- Deleted: 1
- Untracked: 171

Agrupación por dominio (conteo total por dominio):
- docs runtime: 28
- docs architecture/final: 10
- migrations: 9
- tests: 8
- docker: 5
- api: 30
- frontend: 42
- security: 9
- scripts: 8
- lab artifacts: 8
- MetaBrain clinical: 30
- imaging: 3
- other: 42

## 2) Clasificación por dominio (GO / CAUTION / NO-GO)

### GO
- docs runtime (subconjunto): reportes runtime con 0 hits en secretos/PHI/red sensible.
- tests (subconjunto): potencialmente GO solo tras auditoría de contenido en tests de runtime puros (actualmente no hay lote de tests limpio listo sin revisión adicional).

### CAUTION
- docs runtime (subconjunto): archivos con señales de PHI/net o referencias de origen que requieren scrub técnico.
- docs architecture/final: documentos amplios con alta densidad de términos clínicos/contextuales; requieren scrub y revisión de topología interna antes de commit.
- migrations: tienen markers de downgrade, pero también señales de cambios destructivos y campos sensibles; no aptas para lote rápido sin plan de rollback validado.
- docker/api/frontend/scripts/security/lab artifacts: mezcla de alto impacto y/o riesgo de secretos; no aptos para próximo lote atómico de docs seguros.

### NO-GO
- MetaBrain clinical (incluye rutas MetaBrain/ y documentación MEDICAL_*, CLINICAL_*, HUMAN_REVIEW_*).
- imaging (IMAGE_* y rutas de imaging).
- todo lo que involucre PHI, payloads médicos reales, multimodal clinical o providers clínicos sin hardening final.

## 3) Auditoría docs runtime

Cobertura auditada:
- RUNTIME_*.md
- OBSERVABILITY_*.md
- NODE_RUNTIME_*.md

Hallazgos de patrón (sin exponer contenido):
- Señales elevadas (SCRUB_REQUIRED):
  - RUNTIME_ORIGIN_AUDIT.md (secret_hits=4, net_hits=27)
  - RUNTIME_PHI_LEAKAGE_CHECK.md (secret_hits=2, phi_hits=3)
- Señales medias (CAUTION): varios runtime/observability con phi_hits > 0 o net_hits > 0.
- Candidatos limpios para lote seguro (GO):
  - RUNTIME_HTTP_E2E_REPORT.md
  - RUNTIME_IMPORT_FAILURE_REPORT.md
  - RUNTIME_IMPORT_SUCCESS_REPORT.md
  - RUNTIME_LATENCY_BASELINE.md
  - RUNTIME_MEMORY_BASELINE.md
  - RUNTIME_WORKTREE_SAFETY_REPORT.md
  (todos con secret_hits=0, phi_hits=0, net_hits=0 en esta pasada)

## 4) Auditoría architecture/final docs

Cobertura auditada:
- ARCHITECTURE_*
- FINAL_*

Resultado:
- Sin hit de secretos explícitos en la pasada de patrones.
- Con alta presencia de términos clínicos/contextuales (phi_hits > 0 en todos los archivos auditados).
- Clasificación:
  - GO: ninguno por ahora.
  - SCRUB_REQUIRED: todos los FINAL_* y ARCHITECTURE_* auditados.
  - NO-GO: ninguno automático en esta fase, pero bloqueados para commit hasta scrub detallado.

## 5) Auditoría migrations

Cobertura:
- alembic/versions/* (9 archivos en status)

Resultado:
- Todos presentan markers de rollback/downgrade.
- También presentan múltiples markers potencialmente destructivos y/o sensibles (incluyendo campos de pacientes en parte del lote).
- Clasificación:
  - GO: ninguno.
  - CAUTION: todos (requieren rollback plan + verificación de irreversibilidad + impacto PHI).
  - NO-GO inmediato para lote rápido de documentación.

## 6) Auditoría tests

Cobertura en status:
- api/tests/
- brain/tests/
- tests/unit/test_runtime_integration.py
- medical-agenda-saas/tests/nlp/*.test.ts

Resultado:
- Tests NLP medical muestran señales clínicas/provider dependiente (NO-GO para lote seguro).
- tests/unit/test_runtime_integration.py muestra señales mixtas runtime + provider/clinical (CAUTION).
- api/tests/ y brain/tests/ están como directorios untracked; requieren inventario interno antes de clasificación final.

Clasificación:
- GO: ninguno listo para commit inmediato sin revisión adicional de contenido.
- CAUTION: tests/unit/test_runtime_integration.py, api/tests/, brain/tests/.
- NO-GO: medical-agenda-saas/tests/nlp/*medical* y groq-doctor-chat relacionados con clínica/proveedores.

## 7) Próximo lote recomendado (único, atómico, seguro)

Lote propuesto:
- docs(runtime): safe baseline reports batch

Lista exacta recomendada:
- RUNTIME_HTTP_E2E_REPORT.md
- RUNTIME_IMPORT_FAILURE_REPORT.md
- RUNTIME_IMPORT_SUCCESS_REPORT.md
- RUNTIME_LATENCY_BASELINE.md
- RUNTIME_MEMORY_BASELINE.md
- RUNTIME_WORKTREE_SAFETY_REPORT.md

Riesgos del lote propuesto:
- Bajo, condicionado a revalidación puntual pre-stage por archivo.
- Riesgo principal: mezcla accidental con otros untracked del mismo dominio.

Exclusiones obligatorias del lote:
- RUNTIME_ORIGIN_AUDIT.md
- RUNTIME_PHI_LEAKAGE_CHECK.md
- todo FINAL_*
- todo ARCHITECTURE_*
- todo alembic/versions/*
- MetaBrain/* clinical
- IMAGE_*
- MEDICAL_*, CLINICAL_*, HUMAN_REVIEW_*

Validaciones requeridas antes de commit del lote recomendado:
1. git diff -- <archivo> para cada archivo del lote.
2. grep defensivo en subset con patrones de secretos/PHI/token/cookies.
3. git add archivo-por-archivo (nunca git add .).
4. git diff --cached --name-only (debe listar solo esos 6 archivos).
5. git diff --cached --stat y revisión final de contenido.

## 8) Readiness para canary

Estado actual de canary readiness:
- Parcial / condicional.

Justificación:
- Existe un lote pequeño de docs runtime con perfil de riesgo bajo que puede avanzar.
- Persisten dominios de alto riesgo (migrations, MetaBrain clinical, imaging, tests provider/clinical) que requieren fases separadas.
- Recomendado mantener estrategia de commits atómicos por dominio con gate de seguridad documental previo.
