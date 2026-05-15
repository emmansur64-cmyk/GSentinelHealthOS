# Secretaria Agenda Staging Execution Fixtures

Fecha: 2026-05-15

## Directorio temporal

`%TEMP%/gsentinel-secretaria-agenda-staging-mock/fixtures`

## Fixtures creados

- `valid.csv`: CSV valido con dos filas artificiales.
- `valid.xlsx`: XLSX valido con dos filas artificiales.
- `duplicate.csv`: CSV con duplicado exacto artificial.
- `overlap.csv`: CSV con solape artificial por medico/sede/dia.
- `invalid-time.csv`: CSV con horario invalido artificial.

## Datos usados

- `Dra Test Local`
- `Dr Mock Agenda`
- `Clinica Medica Test`
- `Sede Test`
- `lunes`
- `martes`
- Horarios falsos: `09:00-12:00`, `14:00-17:00`, `09:00-11:00`, `10:30-12:00`, `18:00-09:00`

## Datos prohibidos verificados por diseno

- Sin DNI.
- Sin pacientes.
- Sin telefonos reales.
- Sin correos reales.
- Sin historia clinica.
- Sin claves reales.

## Nota

Los fixtures son temporales y no estan destinados a commit.
