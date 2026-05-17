# GITHUB SSH UPLOAD PRECHECK

Fecha: 2026-05-17
Proyecto: `E:\GSentinelHealthOS`
Objetivo: auditoria previa para subida segura por SSH sin secretos/PHI.

## 1) Estado de entorno y Git

- `git rev-parse --is-inside-work-tree`: `true`
- Rama actual: `GsentinelH`
- Remote actual:
  - `origin https://github.com/emmansur64-cmyk/GSentinelHealthOS.git` (HTTPS)
- Identidad Git:
  - `user.name`: `Emmanuel Gatica`
  - `user.email`: `251084954+emmansur64-cmyk@users.noreply.github.com`
- SSH GitHub:
  - `ssh -T git@github.com` autenticacion OK (`Hi emmansur64-cmyk! ...`)

## 2) Hallazgos de riesgo (archivos peligrosos)

### 2.1 Archivos sensibles encontrados (presencia)

- Variables de entorno reales/locales:
  - `.env`
  - `.env.runtime_lab`
  - `.env.runtime_lab_docker`
  - `Panel-SuperAdmin/.env.local`
  - `medical-agenda-saas/.env.local`
- Base de datos local / artifacts:
  - `runtime_lab.sqlite`
  - `test_panel.db`
- Datos potencialmente sensibles de entrenamiento:
  - `MB-Chat/data/medical-chat-learning.jsonl` (tracked y modificado)

### 2.2 Tipos de carpetas no aptas para subir

Se detectaron en el arbol (incluyendo subproyectos):

- `node_modules/`
- `dist/`
- `.next/`
- `coverage/` (en dependencias)
- `backups/`
- `tmp/`, `temp/`
- `logs/` (incluyendo `.git/logs` y logs de runtime)

Nota: gran parte ya esta ignorada, pero existe alto volumen de artefactos locales.

### 2.3 Escaneo de patrones sensibles en contenido

Se ejecuto busqueda de patrones: `password|secret|api_key|token|bearer|private_key|postgres://|mongodb://|redis://|jwt|authorization|cookie|dni|patient|paciente|historia clinica|phone|email`.

Resultado:

- Muchos match en:
  - `.env.example` y archivos de configuracion/infra (esperable)
  - codigo de auth y middleware (esperable)
  - tests y docs
  - migraciones con campos clinicos (`dni`, `patient_*`) por dominio
- No se confirma exfiltracion automatica de secretos reales por este scan; requiere **stage selectivo estricto**.

## 3) Estado del worktree (riesgo operativo)

- Worktree muy grande y mixto (muchos `M`, `D`, `??`).
- Riesgo alto de incluir cambios no deseados si se usa `git add .`.
- Politica recomendada: stage por archivo/ruta aprobada unicamente.

## 4) Hardening `.gitignore` aplicado

Se amplio `.gitignore` sin borrar reglas previas con bloque minimo solicitado:

- `.env`, `.env.*`, `!.env.example`
- `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`, `logs/`
- `tmp/`, `temp/`, `backups/`
- `*.bak`, `*.dump`, `*.sql`, `*.sqlite`, `*.db`
- `*.pem`, `*.key`, `*.crt`, `*.p12`
- `uploads/`, `storage/`, `volumes/`, `.docker/`
- `.DS_Store`, `Thumbs.db`

Validacion: `git status --ignored --short` confirma ignorado de `.env`, `.env.runtime_lab`, `.next`, `node_modules`, `runtime_lab.sqlite`, `test_panel.db`, etc.

## 5) Bloqueos / pendientes antes de push

1. Cambiar `origin` de HTTPS a SSH del mismo repo.
2. Definir alcance exacto de stage (hay demasiados cambios abiertos).
3. Excluir explicitamente `MB-Chat/data/medical-chat-learning.jsonl` si contiene datos sensibles o si no es imprescindible.
4. Ejecutar validaciones minimas por subproyecto antes de commit.

## 6) Conclusión de precheck

- SSH con GitHub: **OK**.
- Repo Git existente: **SI**.
- Riesgo principal actual: **worktree masivo + archivos sensibles presentes localmente**.
- Condicion para avanzar segura: **stage selectivo y auditoria final de staged files**.
