export type TelemetryPolicy = {
  maxPayloadKeys: number;
  maxStringLength: number;
  redactPhi: boolean;
  allowExternalExport: boolean;
};

export const DEFAULT_TELEMETRY_POLICY: TelemetryPolicy = {
  maxPayloadKeys: 50,
  maxStringLength: 500,
  redactPhi: true,
  allowExternalExport: false,
};
