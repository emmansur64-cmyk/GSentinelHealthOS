# Agenda Import Dry-Run Selective Commit Precheck

Fecha: 2026-05-15
Modulo objetivo: `medical-agenda-saas`

## Comandos ejecutados

```powershell
git status --short
git diff --name-only -- medical-agenda-saas
git status --short -- medical-agenda-saas
```

## Hallazgos

- El worktree global contiene muchos cambios fuera de alcance, incluyendo MB-Secretaria, MetaBrain y reportes raiz.
- Esos cambios no se deben stagear ni incluir.
- Dentro de `medical-agenda-saas` hay cambios esperados para el endpoint dry-run y sus reportes.
- `git diff --name-only -- medical-agenda-saas` lista solo `.gitignore` porque los archivos nuevos aun estaban untracked al momento del precheck.

## Archivos candidate dentro de scope

- `medical-agenda-saas/.gitignore`
- `medical-agenda-saas/.env.example`
- `medical-agenda-saas/AGENDA_IMPORT_DRY_RUN_CONTRACT.md`
- `medical-agenda-saas/AGENDA_IMPORT_DRY_RUN_PRECHECK.md`
- `medical-agenda-saas/AGENDA_IMPORT_DRY_RUN_RESULT.md`
- `medical-agenda-saas/AGENDA_IMPORT_DRY_RUN_SECURITY_REPORT.md`
- `medical-agenda-saas/AGENDA_IMPORT_DRY_RUN_TEST_REPORT.md`
- `medical-agenda-saas/src/app/admin/schedule-import/dry-run/route.ts`
- `medical-agenda-saas/src/lib/admin-schedule-import-dry-run.ts`
- `medical-agenda-saas/tests/schedule-import-dry-run.test.ts`

## Decision

Continuar solo si las validaciones pasan y el stage final contiene exclusivamente archivos bajo `medical-agenda-saas/`.
