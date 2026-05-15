import { buildRollbackRegistry } from "./rollback-registry";
import { validateProductionSafetyStartup } from "./startup-validator";

export function buildProductionSafetyReport(env: NodeJS.ProcessEnv = process.env) {
  const startup = validateProductionSafetyStartup(env);
  return {
    status: startup.ok ? "safe_defaults" : "unsafe_flags_detected",
    startup,
    rollback_registry: buildRollbackRegistry(),
    generated_at: new Date().toISOString(),
  };
}
