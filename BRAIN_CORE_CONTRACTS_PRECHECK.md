# BRAIN CORE CONTRACTS - PRECHECK

Fecha: 2026-05-15
Repositorio: GSentinelHealthOS
Workspace: E:/GSentinelHealthOS

## 1. Rama actual

- Rama detectada: `GsentinelH`
- Estado esperado: OK

## 2. Ultimos commits

Salida verificada de `git log --oneline -5`:

1. `6b1d41b fix(metabrain): harden critical routing guards`
2. `65390a2 docs(runtime): add runtime validation reports`
3. `aa85105 fix(gitignore): narrow env dump ignore patterns`
4. `78cf479 chore(gitignore): prevent accidental env dump tracking`
5. `4efd159 docs(event-bus): add runtime event bus audit reports`

Chequeo de commit base critico `6b1d41b`: PRESENTE (HEAD actual)

## 3. Estado inicial del worktree

- `git status --short`: worktree sucio preexistente
- Hallazgo: hay cambios modificados (`M`) y no trackeados (`??`) en Brain, API, frontend y docs.
- Hallazgo critico de riesgo de mezcla: tambien hay cambios en `medical-agenda-saas` previos a esta fase.

Resumen operacional:

- Se asume worktree sucio como condicion inicial.
- Esta fase no revierte ni limpia cambios previos.
- Se trabaja de forma selectiva y sin `git add .`.

## 4. Archivos candidatos de auditoria (lectura)

Brain Core (Python):

- `brain/app.py`
- `brain/orchestration/orchestrator.py`
- `brain/core/decision_core.py`
- `brain/decision_engine/triage_engine.py`
- `brain/contracts/routing.py`
- `brain/routing/role_router.py`
- `brain/routing/triage_eligibility.py`
- `brain/main.py`
- `brain/services/orchestrator.py`
- `brain/services/whatsapp_appointment_intake_service.py`
- `brain/integration/api_client.py`

Entry points y bridges actuales (TS/Python):

- `api/app/api/v1/endpoints/brain_decide.py`
- `api/app/main.py`
- `medical-agenda-saas/src/lib/brain-client.ts`
- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/app/chat/doctor/route.ts`
- `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts`
- `medical-agenda-saas/src/lib/whatsapp/metabrain-assistant.ts`
- `medical-agenda-saas/src/app/api/import/agenda/parse/route.ts`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`

## 5. Riesgos iniciales

1. Riesgo de mezcla de dominios: chat medico, WhatsApp e importacion administrativa coexisten en capas compartidas.
2. Riesgo de contrato dual: `/orchestrate` y `/api/v1/brain/decide` conviven con payloads distintos.
3. Riesgo de bypass de contratos MB: actualmente no existen aun contratos MB-Chat/MB-Secretaria/MB-Whatsapp formalizados como capa unica.
4. Riesgo de acoplamiento DB directo en flujos frontend de WhatsApp y chat, fuera de Brain Core.
5. Riesgo de merge accidental por worktree amplio y sucio.

## 6. Confirmaciones de seguridad operativa de esta fase

Confirmado para esta fase:

- NO deploy
- NO restart de contenedores
- NO tocar produccion
- NO separacion fisica de MB-Chat/MB-Secretaria/MB-Whatsapp
- NO duplicacion de Brain
- NO migracion de `medical-agenda-saas`
- NO cambios de runtime
