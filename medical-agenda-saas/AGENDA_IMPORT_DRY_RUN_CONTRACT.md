# Agenda Import Dry-Run Contract

Endpoint:

`POST /admin/schedule-import/dry-run`

## Request

```json
{
  "tenantId": "tenant-1",
  "batchId": "batch-1",
  "batchIdempotencyKey": "batch-idem-1",
  "rows": [
    {
      "rowNumber": 1,
      "rowIdempotencyKey": "row-idem-1",
      "doctorName": "Dra Ana Gomez",
      "specialty": "Clinica",
      "location": "Sede Centro",
      "dayOfWeek": "lunes",
      "startTime": "08:00",
      "endTime": "12:00"
    }
  ],
  "mode": "dry_run",
  "apply": false,
  "contractVersion": "mb-secretaria-import-v1"
}
```

## Response exitosa

```json
{
  "status": "dry_run_ok",
  "apply": false,
  "wouldWrite": false,
  "tenantId": "tenant-1",
  "batchId": "batch-1",
  "batchIdempotencyKey": "batch-idem-1",
  "summary": {
    "receivedRows": 1,
    "acceptedRows": 1,
    "rejectedRows": 0,
    "warnings": 0
  },
  "rows": [
    {
      "rowNumber": 1,
      "rowIdempotencyKey": "row-idem-1",
      "status": "accepted",
      "errors": [],
      "warnings": []
    }
  ]
}
```

## Reglas

- `mode` debe ser `dry_run`.
- `apply` debe ser `false`.
- `tenantId` es obligatorio.
- `batchIdempotencyKey` es obligatorio.
- Cada fila debe incluir `rowIdempotencyKey`.
- `startTime` y `endTime` deben tener formato `HH:mm`.
- `startTime` debe ser menor que `endTime`.
- `wouldWrite` siempre es `false`.
- El contrato no aplica cambios reales ni crea turnos.

## Compatibilidad MB-Secretaria

El contrato usa `contractVersion: mb-secretaria-import-v1` y conserva los campos esperados por el import preview dry-run de MB-Secretaria.
