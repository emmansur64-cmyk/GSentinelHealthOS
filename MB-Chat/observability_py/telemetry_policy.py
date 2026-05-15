from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TelemetryPolicy:
    max_payload_keys: int = 50
    max_string_length: int = 500
    redact_phi: bool = True
    allow_external_export: bool = False


DEFAULT_TELEMETRY_POLICY = TelemetryPolicy()
