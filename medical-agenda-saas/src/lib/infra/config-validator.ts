/**
 * Infrastructure Configuration Validator
 *
 * Valida que toda la configuración necesaria esté presente y correcta
 * ANTES de ejecutar tests. Falla rápido con diagnóstico detallado.
 */
import { z } from "zod";
import { infraLog, measureAsync } from "./infra-logger";
import { ensureRedisAvailable, isRedisPortOpen } from "./redis-health";

// ─── Validation Schemas ──────────────────────────────────────────────────────

const databaseUrlSchema = z
  .string()
  .min(1, "DATABASE_URL is required")
  .refine(
    (url) => {
      try {
        // Aceptar postgresql:// o postgres://
        return url.startsWith("postgresql://") || url.startsWith("postgres://");
      } catch {
        return false;
      }
    },
    { message: "DATABASE_URL must be a valid PostgreSQL URL" },
  );

const redisUrlSchema = z
  .string()
  .default("redis://localhost:6379")
  .refine(
    (url) => {
      try {
        return url.startsWith("redis://") || url.startsWith("rediss://");
      } catch {
        return false;
      }
    },
    { message: "REDIS_URL must be a valid Redis URL" },
  );

const infraConfigSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  REDIS_URL: redisUrlSchema,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Test-specific
  TEST_RUN_ID: z.string().uuid().optional(),
  INFRA_STRICT_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type InfraConfig = z.infer<typeof infraConfigSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  config?: InfraConfig;
  errors: string[];
  warnings: string[];
}

export interface ConnectivityResult {
  service: string;
  available: boolean;
  latencyMs?: number;
  error?: string;
}

export interface FullValidationResult {
  configValid: boolean;
  servicesAvailable: boolean;
  config?: InfraConfig;
  connectivity: ConnectivityResult[];
  errors: string[];
  warnings: string[];
}

// ─── Configuration Validation ────────────────────────────────────────────────

/**
 * Valida la configuración de entorno
 */
export function validateConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawConfig = {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
    NODE_ENV: process.env.NODE_ENV,
    TEST_RUN_ID: process.env.TEST_RUN_ID,
    INFRA_STRICT_MODE: process.env.INFRA_STRICT_MODE,
  };

  const result = infraConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { valid: false, errors, warnings };
  }

  // Warnings
  if (!process.env.TEST_RUN_ID) {
    warnings.push(
      "TEST_RUN_ID not set - tests may not have proper isolation. " +
        "Set TEST_RUN_ID=$(uuidgen) before running tests.",
    );
  }

  if (result.data.NODE_ENV === "production") {
    warnings.push(
      "NODE_ENV=production detected - this configuration is not recommended for tests",
    );
  }

  return {
    valid: true,
    config: result.data,
    errors,
    warnings,
  };
}

// ─── Connectivity Validation ─────────────────────────────────────────────────

/**
 * Parsea URL de PostgreSQL para extraer host y puerto
 */
function parsePostgresUrl(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port, 10) || 5432,
    };
  } catch {
    return { host: "localhost", port: 5432 };
  }
}

/**
 * Verifica si el puerto de PostgreSQL está accesible
 */
async function isDatabasePortOpen(host: string, port: number): Promise<boolean> {
  const net = await import("net");

  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 2000;

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Verifica conectividad a PostgreSQL
 */
async function checkDatabaseConnectivity(
  databaseUrl: string,
): Promise<ConnectivityResult> {
  const { host, port } = parsePostgresUrl(databaseUrl);

  const { result: portOpen, durationMs } = await measureAsync(() =>
    isDatabasePortOpen(host, port),
  );

  if (!portOpen) {
    return {
      service: "PostgreSQL",
      available: false,
      error: `Cannot connect to PostgreSQL at ${host}:${port}. Ensure the database is running.`,
    };
  }

  return {
    service: "PostgreSQL",
    available: true,
    latencyMs: durationMs,
  };
}

/**
 * Verifica conectividad a Redis
 */
async function checkRedisConnectivity(redisUrl: string): Promise<ConnectivityResult> {
  const result = await ensureRedisAvailable({ url: redisUrl });

  if (!result.available) {
    return {
      service: "Redis",
      available: false,
      error: result.error,
    };
  }

  return {
    service: "Redis",
    available: true,
    latencyMs: result.latencyMs,
  };
}

// ─── Full Validation ─────────────────────────────────────────────────────────

/**
 * Validación completa: configuración + conectividad.
 *
 * Usar antes de ejecutar tests para fail-fast.
 */
export async function validateInfrastructure(): Promise<FullValidationResult> {
  infraLog("info", "Validating infrastructure configuration...");

  // Step 1: Validate configuration
  const configResult = validateConfig();

  if (!configResult.valid) {
    return {
      configValid: false,
      servicesAvailable: false,
      connectivity: [],
      errors: configResult.errors,
      warnings: configResult.warnings,
    };
  }

  const config = configResult.config!;

  // Step 2: Check connectivity (in parallel)
  infraLog("info", "Checking service connectivity...");

  const [dbResult, redisResult] = await Promise.all([
    checkDatabaseConnectivity(config.DATABASE_URL),
    checkRedisConnectivity(config.REDIS_URL),
  ]);

  const connectivity = [dbResult, redisResult];
  const unavailable = connectivity.filter((c) => !c.available);

  // Log results
  for (const result of connectivity) {
    if (result.available) {
      infraLog("info", `${result.service} connected`, { durationMs: result.latencyMs });
    } else {
      infraLog("error", `${result.service} unavailable: ${result.error}`);
    }
  }

  const errors = [
    ...configResult.errors,
    ...unavailable.map((c) => c.error!),
  ];

  return {
    configValid: true,
    servicesAvailable: unavailable.length === 0,
    config,
    connectivity,
    errors,
    warnings: configResult.warnings,
  };
}

/**
 * Valida infraestructura y lanza error si falla.
 * Modo estricto: aborta si cualquier servicio no está disponible.
 */
export async function requireInfrastructure(): Promise<InfraConfig> {
  const result = await validateInfrastructure();

  // Print warnings
  for (const warning of result.warnings) {
    infraLog("warn", warning);
  }

  if (!result.configValid) {
    const errorMsg = [
      "[INFRA] Configuration validation failed:",
      ...result.errors.map((e) => `  - ${e}`),
    ].join("\n");
    throw new Error(errorMsg);
  }

  if (!result.servicesAvailable) {
    const errorMsg = [
      "[INFRA] Required services not available:",
      ...result.errors.map((e) => `  - ${e}`),
      "",
      "Tests CANNOT run without infrastructure.",
      "Please start PostgreSQL and Redis before running tests.",
    ].join("\n");
    throw new Error(errorMsg);
  }

  infraLog("info", "Infrastructure validation passed");
  return result.config!;
}

/**
 * Genera un informe de diagnóstico detallado
 */
export async function generateDiagnosticReport(): Promise<string> {
  const result = await validateInfrastructure();

  const lines: string[] = [
    "═══════════════════════════════════════════════════════════════════",
    "                    INFRASTRUCTURE DIAGNOSTIC REPORT",
    "═══════════════════════════════════════════════════════════════════",
    "",
    "Configuration:",
    `  DATABASE_URL: ${process.env.DATABASE_URL ? "✓ set" : "✗ missing"}`,
    `  REDIS_URL: ${process.env.REDIS_URL || "redis://localhost:6379"} (default)`,
    `  NODE_ENV: ${process.env.NODE_ENV || "not set"}`,
    `  TEST_RUN_ID: ${process.env.TEST_RUN_ID || "not set"}`,
    "",
    "Connectivity:",
  ];

  for (const conn of result.connectivity) {
    const status = conn.available ? "AVAILABLE" : "UNAVAILABLE";
    const time = conn.latencyMs ? ` (${conn.latencyMs}ms)` : "";
    lines.push(`  ${conn.service}: ${status}${time}`);
    if (conn.error) {
      lines.push(`    Error: ${conn.error}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    for (const error of result.errors) {
      lines.push(`  - ${error}`);
    }
  }

  lines.push(
    "",
    "═══════════════════════════════════════════════════════════════════",
  );

  return lines.join("\n");
}
