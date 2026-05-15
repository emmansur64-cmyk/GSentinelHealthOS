# MB-Secretaria

Modulo administrativo para preparacion futura de cargas de Secretaria Medica.

Estado actual:
- No implementa importador real de planillas.
- No aplica cambios sobre agenda.
- No escribe en base de datos.
- No expone transporte de mensajeria.
- Mantiene guardias defensivas para payloads administrativos.

Capacidades permitidas por contrato:
- spreadsheet_ingestion
- document_parsing
- availability_normalization
- schedule_preview
- agenda_api_prepare_payload
- audit_report_generation

Proxima fase requerida:
- Implementar upload, parser, preview, validadores por fila, cliente Agenda API, idempotencia y auditoria transaccional.
