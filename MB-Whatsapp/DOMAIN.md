# MB-Whatsapp Domain

Physical domain cloned from `MetaBrain` for incremental separation.

## Keeps

- WhatsApp transport and WhatsApp conversation boundary.
- Appointment booking, confirmation, cancellation and reschedule flows through Agenda API authority.
- Contracts, validators, auth, tenant and logging.
- Domain-isolated Groq WhatsApp provider configuration.

## Disabled

- Clinical diagnosis and deep clinical reasoning.
- `doctor_professional` and `clinical_support` modes.
- Spreadsheet ingestion and secretary imports.
- Full clinical history access.

## Provider configuration

- Reads `GROQ_API_KEY_WHATSAPP`.
- Reads `GROQ_MODEL_WHATSAPP`.
- Does not fallback to generic `GROQ_API_KEY`.
