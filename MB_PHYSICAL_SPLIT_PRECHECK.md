# MB Physical Split Precheck

Fecha/hora: 2026-05-15T12:05:29.8414625-03:00

## Rama

- Rama actual: `GsentinelH`
- Rama esperada: `GsentinelH`
- Resultado: OK

## Commits relevantes presentes

- `7fe5f38 feat(agenda-api): establish explicit scheduling authority layer`
- `64e067d feat(brain-core): integrar validadores runtime en entrypoints reales (fase 2)`
- `1a6eca4 feat(brain-core): integrate runtime validators in real entrypoints`
- `6461957 docs(brain-core): define modular contracts and focused guards`
- `6b1d41b fix(metabrain): harden critical routing guards`

## Estado inicial de git

```text
?? GIT_BRANCH_RECOVERY_PLAN.md
?? GIT_BRANCH_STRATEGY_PRECHECK.md
?? GIT_BRANCH_STRATEGY_RESULT.md
?? GIT_HISTORY_INTEGRITY_AUDIT.md
?? GIT_REMOTE_BRANCH_AUDIT.md
?? PR_TARGET_READINESS_AUDIT.md
```

Los archivos anteriores son reportes de auditoria de ramas preexistentes y quedan fuera del alcance de esta fase.

## Ruta real de MetaBrain

- Ruta: `E:\GSentinelHealthOS\MetaBrain`
- Tamano aproximado total: 28,167 archivos, 533.15 MB
- Peso dominante detectado: `MetaBrain\node_modules` con 523.07 MB

## Riesgos iniciales

- Duplicar `node_modules` triplicaria artefactos generados sin aportar separacion funcional.
- MetaBrain contiene mezcla de responsabilidades: clinica, booking, NLG, providers, observabilidad, memoria, reglas y scripts.
- Existen referencias internas a `MetaBrain` en algunos providers Python que deberan tratarse con cuidado en una migracion posterior.
- Las carpetas destino no existian antes del inicio de la fase: `MB-Chat`, `MB-Secretaria`, `MB-Whatsapp`.
- El runtime legacy no debe cambiar de callers en esta fase.

## Confirmacion de seguridad

- NO deploy.
- NO restart.
- NO produccion.
- NO eliminacion de MetaBrain original.
- NO migracion masiva.
- NO commit automatico.
