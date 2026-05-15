import { validateProductionEnv } from "./env-validator";
import { buildProductionSafetyHealth } from "./health-check";
import { evaluateRuntimeGuard, loadProductionSafetyConfig } from "./runtime-guard";
import type { StartupValidationResult } from "./types";

export function validateProductionSafetyStartup(env: NodeJS.ProcessEnv = process.env): StartupValidationResult {
  const config = loadProductionSafetyConfig(env);
  const guard = evaluateRuntimeGuard(config);
  const envValidation = validateProductionEnv(env);
  const errors = [...envValidation.dangerous_flags];
  const warnings = [...envValidation.warnings];

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    guard,
    health: buildProductionSafetyHealth(config),
    created_at: new Date().toISOString(),
  };
}
