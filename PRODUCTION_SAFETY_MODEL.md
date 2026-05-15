# PRODUCTION SAFETY MODEL

## Que se puede activar

En Fase 9 no se activa nada en runtime real.

Futuras activaciones solo pueden considerarse si:

- `AI_RUNTIME_KILL_SWITCH=false` fue aprobado;
- `AI_RUNTIME_DRY_RUN=true` para primera etapa;
- existe safety model;
- existe rollback plan;
- existe validation report;
- existe PHI review;
- existe clinical safety review.

## Que NO se puede activar

Permanece prohibido:

- providers externos automaticos;
- vision medica real;
- DICOM real;
- vector DB real;
- human review blocking real;
- confidence enforcement real;
- observability export externa;
- decisiones clinicas autonomas;
- diagnostico definitivo.

## Condiciones minimas

Antes de activar cualquier capa:

- feature flag explicito;
- kill switch probado;
- dry-run probado;
- shadow mode probado;
- fallback probado;
- rollback probado;
- trazabilidad por `trace_id`;
- no exposicion PHI.

## Proteccion de agenda, WhatsApp, login y APIs

La capa de seguridad declara que safe fallback nunca debe:

- bloquear agenda;
- bloquear WhatsApp;
- bloquear login;
- bloquear APIs criticas;
- frenar flujo principal por falla de IA.

## PHI restrictions

Por defecto:

- `AI_RUNTIME_PHI_ALLOWED=false`
- `OBSERVABILITY_PHI_ALLOWED=false`
- providers externos no pueden recibir PHI.

## External calls restrictions

Por defecto:

- `AI_RUNTIME_EXTERNAL_CALLS_ALLOWED=false`
- `OBSERVABILITY_EXTERNAL_EXPORT_ENABLED=false`

No se permiten llamadas externas desde esta fase.

## Prohibiciones clinicas

El sistema no puede:

- diagnosticar definitivamente;
- prescribir automaticamente;
- bloquear salida clinica sin revision humana aprobada;
- mezclar pacientes o tenants;
- activar aprendizaje autonomo.
