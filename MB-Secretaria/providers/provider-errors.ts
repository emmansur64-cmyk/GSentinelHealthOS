export class ProviderRouterError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly blockedByPolicy = false,
  ) {
    super(message);
    this.name = "ProviderRouterError";
  }
}

export const PROVIDER_ERROR_CODES = {
  ROUTER_DISABLED: "router_disabled",
  SHADOW_MODE: "shadow_mode",
  PROVIDER_NOT_FOUND: "provider_not_found",
  PROVIDER_BLOCKED: "provider_blocked",
  PHI_BLOCKED: "phi_blocked",
  MULTIMODAL_DISABLED: "multimodal_disabled",
  EXTERNAL_IMAGE_DISABLED: "external_image_disabled",
  TIMEOUT: "timeout",
  MALFORMED_OUTPUT: "malformed_output",
} as const;
