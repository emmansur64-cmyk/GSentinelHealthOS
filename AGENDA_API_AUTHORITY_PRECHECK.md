# AGENDA API AUTHORITY PRECHECK

## Rama
- Rama activa: `GsentinelH`

## Ultimos commits (top 12)
- `64e067d` feat(brain-core): integrar validadores runtime en entrypoints reales (fase 2)
- `1a6eca4` feat(brain-core): integrate runtime validators in real entrypoints
- `6461957` docs(brain-core): define modular contracts and focused guards
- `6b1d41b` fix(metabrain): harden critical routing guards
- `65390a2` docs(runtime): add runtime validation reports
- `aa85105` fix(gitignore): narrow env dump ignore patterns
- `78cf479` chore(gitignore): prevent accidental env dump tracking
- `4efd159` docs(event-bus): add runtime event bus audit reports
- `ad84dd6` docs(audit): add runtime and compatibility audit reports
- `9081351` fix(api): restore health and realtime compatibility
- `282626d` fix(api): align runtime-safe non-clinical endpoints
- `3d58875` chore(docker-config): runtime-safe compose and dockerfile alignment

## Estado git inicial
- Worktree sucio documentado con archivos untracked preexistentes de estrategia git:
  - `GIT_BRANCH_RECOVERY_PLAN.md`
  - `GIT_BRANCH_STRATEGY_PRECHECK.md`
  - `GIT_BRANCH_STRATEGY_RESULT.md`
  - `GIT_HISTORY_INTEGRITY_AUDIT.md`
  - `GIT_REMOTE_BRANCH_AUDIT.md`
  - `PR_TARGET_READINESS_AUDIT.md`

## Riesgos iniciales
- Persisten bypass de agenda por Prisma directo en `medical-agenda-saas`.
- Riesgo de mezcla de cambios por worktree historicamente sucio.
- FastAPI Agenda API y rutas Next conviven con contratos y estados diferentes.
- Riesgo de ruptura si se intenta migracion masiva en una sola fase.

## Archivos candidatos
- `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts`
- `medical-agenda-saas/src/repositories/appointmentRepository.ts`
- `medical-agenda-saas/src/services/appointmentEngine.ts`
- `medical-agenda-saas/src/app/api/appointments/route.ts`
- `medical-agenda-saas/src/app/api/appointments/[id]/route.ts`
- `medical-agenda-saas/src/app/api/appointments/update-status/route.ts`
- `api/app/api/v1/endpoints/appointments.py`
- `api/app/services/appointment_service.py`

## Confirmacion de restricciones
- NO deploy
- NO restart
- NO produccion
