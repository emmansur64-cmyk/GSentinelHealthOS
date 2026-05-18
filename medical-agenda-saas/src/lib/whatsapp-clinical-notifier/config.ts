const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  return fallback;
}

export function getClinicalNotifierConfig() {
  const enabled = parseBoolean(process.env.WHATSAPP_CLINICAL_NOTIFIER_ENABLED, false);
  const dryRun = parseBoolean(process.env.WHATSAPP_CLINICAL_NOTIFIER_DRY_RUN, true);

  return {
    enabled,
    dryRun,
    baseUrl: (process.env.WHATSAPP_CLOUD_API_BASE_URL ?? "https://graph.facebook.com").replace(/\/+$/, ""),
    apiVersion: (process.env.WHATSAPP_CLOUD_API_VERSION ?? "v21.0").trim(),
    phoneNumberId: (process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID ?? "").trim(),
    token: (process.env.WHATSAPP_CLOUD_API_TOKEN ?? "").trim(),
    templateName: (process.env.WHATSAPP_TRANSFER_TEMPLATE_NAME ?? "").trim(),
    templateLanguage: (process.env.WHATSAPP_TRANSFER_TEMPLATE_LANGUAGE ?? "es_AR").trim(),
  };
}
