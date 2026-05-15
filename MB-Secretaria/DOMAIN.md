# MB-Secretaria Domain

Physical domain cloned from `MetaBrain` for incremental separation.

## Keeps

- Secretary ingestion.
- Spreadsheet import and document parsing boundaries.
- Availability normalization.
- Agenda API client compatibility, contracts, validators, auth, tenant and logging.
- Domain-isolated Groq secretaria provider configuration.

## Disabled

- Clinical diagnosis and deep clinical reasoning.
- `doctor_professional` and `clinical_support` modes.
- Patient-facing chat and patient-facing automatic triage.
- WhatsApp transport and WhatsApp booking.

## Provider configuration

- Reads `GROQ_API_KEY_SECRETARIA`.
- Reads `GROQ_MODEL_SECRETARIA`.
- Does not fallback to generic `GROQ_API_KEY`.
