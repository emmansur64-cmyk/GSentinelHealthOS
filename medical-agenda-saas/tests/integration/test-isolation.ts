/**
 * Test Isolation Utilities
 *
 * Proporciona aislamiento para cada test usando:
 * - Transacciones con rollback para DB
 * - Namespaces prefijados para Redis
 *
 * Integrado con el módulo @/lib/infra para health checks y logging.
 */
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";
import {
  createIsolatedRedis,
  cleanupNamespace,
  getTestRunId,
  infraLog,
  TIMEOUTS,
  type IsolatedRedisClient,
} from "../../src/lib/infra";

// ─── Prisma Client para Tests ────────────────────────────────────────────────

let testPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    testPrisma = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_URL },
      },
      log: process.env.DEBUG_SQL ? ["query", "error"] : ["error"],
    });
  }
  return testPrisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
}

// ─── Redis Client para Tests (con aislamiento) ───────────────────────────────

let isolatedRedis: IsolatedRedisClient | null = null;

/**
 * Obtiene un cliente Redis aislado con prefijo por TEST_RUN_ID.
 * Todas las keys usan el patrón: test:{TEST_RUN_ID}:*
 */
export async function getTestRedis(): Promise<IORedis> {
  if (!isolatedRedis) {
    isolatedRedis = await createIsolatedRedis({
      url: process.env.REDIS_URL,
    });
    infraLog("info", `Test Redis ready (prefix: ${isolatedRedis.keyPrefix})`);
  }
  return isolatedRedis.redis;
}

/**
 * Obtiene el cliente con utilidades de aislamiento
 */
export async function getIsolatedRedisClient(): Promise<IsolatedRedisClient> {
  if (!isolatedRedis) {
    isolatedRedis = await createIsolatedRedis({
      url: process.env.REDIS_URL,
    });
  }
  return isolatedRedis;
}

export async function disconnectRedis(): Promise<void> {
  if (isolatedRedis) {
    await isolatedRedis.cleanup();
    await isolatedRedis.disconnect();
    isolatedRedis = null;
  }
}

// ─── Database Cleanup ────────────────────────────────────────────────────────

/**
 * Limpia todas las tablas de test en orden correcto (respetando FKs).
 * Usar en beforeEach para aislamiento completo.
 */
export async function cleanDatabase(): Promise<void> {
  const prisma = getTestPrisma();

  // Orden de eliminación respetando foreign keys
  await prisma.$transaction([
    prisma.incomingMessage.deleteMany(),
    prisma.outgoingMessage.deleteMany(),
    prisma.conversationState.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.availabilityRule.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.doctorProfile.deleteMany(),
    prisma.auditLog.deleteMany(),
    // No eliminamos users/sessions porque pueden ser necesarios para auth
  ]);
}

/**
 * Limpia solo datos de una sesión de test específica.
 * Más rápido que cleanDatabase() cuando se usan prefijos de test.
 */
export async function cleanTestData(testId: string): Promise<void> {
  const prisma = getTestPrisma();
  const prefix = `test_${testId}`;

  await prisma.$transaction([
    prisma.incomingMessage.deleteMany({
      where: { from_phone: { startsWith: prefix } },
    }),
    prisma.outgoingMessage.deleteMany({
      where: { phone: { startsWith: prefix } },
    }),
    prisma.conversationState.deleteMany({
      where: { phone: { startsWith: prefix } },
    }),
    prisma.patient.deleteMany({
      where: { phone: { startsWith: prefix } },
    }),
  ]);
}

// ─── Redis Cleanup ───────────────────────────────────────────────────────────

/**
 * Limpia las keys del namespace de test actual.
 * NO usa flushDb para evitar eliminar datos de otros tests paralelos.
 */
export async function cleanRedis(): Promise<void> {
  if (isolatedRedis) {
    await isolatedRedis.cleanup();
  }
}

/**
 * Limpia keys de Redis con un patrón específico dentro del namespace.
 */
export async function cleanRedisKeys(pattern: string): Promise<void> {
  const redis = await getTestRedis();
  const client = await getIsolatedRedisClient();
  const fullPattern = `${client.keyPrefix}:${pattern}`;
  
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", fullPattern, "COUNT", 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}

// ─── Transaction Wrapper ─────────────────────────────────────────────────────

/**
 * Ejecuta un test dentro de una transacción que hace rollback al finalizar.
 * Útil para tests que necesitan aislamiento total sin limpiar datos.
 *
 * NOTA: No funciona con operaciones que requieren commits intermedios
 * (como pg_advisory_xact_lock que se libera en commit).
 */
export async function withRollback<T>(
  fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>,
): Promise<T> {
  const prisma = getTestPrisma();

  // Usamos un enfoque de savepoint manual
  try {
    return await prisma.$transaction(async (tx) => {
      const result = await fn(tx);
      // Forzar rollback lanzando error especial
      throw new RollbackError(result);
    });
  } catch (error) {
    if (error instanceof RollbackError) {
      return error.result as T;
    }
    throw error;
  }
}

class RollbackError extends Error {
  constructor(public result: unknown) {
    super("Intentional rollback");
    this.name = "RollbackError";
  }
}

// ─── Test Fixtures ───────────────────────────────────────────────────────────

export interface TestFixtures {
  doctor: {
    userId: string;
    doctorId: string;
    email: string;
    name: string;
  };
  patient: {
    id: string;
    name: string;
    phone: string;
  };
}

/**
 * Crea fixtures básicos para tests.
 * Usa un ID único para evitar colisiones entre tests paralelos.
 */
export async function createTestFixtures(testId: string): Promise<TestFixtures> {
  const prisma = getTestPrisma();
  const suffix = testId.slice(0, 8);

  // Crear usuario/doctor
  const user = await prisma.user.create({
    data: {
      email: `doctor_${suffix}@test.com`,
      name: `Dr. Test ${suffix}`,
      password_hash: "$2a$10$test",
      role: "doctor",
    },
  });

  const doctor = await prisma.doctorProfile.create({
    data: {
      user_id: user.id,
      specialty: "General",
      matricula: `TEST-${suffix}`,
      ai_tag: `doctor_test_${suffix}`,
    },
  });

  // Crear paciente
  const patient = await prisma.patient.create({
    data: {
      name: `Test Patient ${suffix}`,
      phone: `+549110000${suffix}`,
    },
  });

  return {
    doctor: {
      userId: user.id,
      doctorId: doctor.user_id,
      email: user.email,
      name: user.name,
    },
    patient: {
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
    },
  };
}

/**
 * Elimina fixtures creados por createTestFixtures.
 */
export async function deleteTestFixtures(fixtures: TestFixtures): Promise<void> {
  const prisma = getTestPrisma();

  await prisma.$transaction([
    prisma.appointment.deleteMany({ where: { patient_id: fixtures.patient.id } }),
    prisma.patient.delete({ where: { id: fixtures.patient.id } }),
    prisma.doctorProfile.delete({ where: { user_id: fixtures.doctor.userId } }),
    prisma.user.delete({ where: { id: fixtures.doctor.userId } }),
  ]);
}

// ─── Vitest Hooks Helpers ────────────────────────────────────────────────────

import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { v4 as uuidv4 } from "uuid";

/**
 * Configura hooks estándar para tests de integración con DB.
 * Limpia la DB antes de cada test para aislamiento.
 */
export function useDbIsolation(): void {
  beforeAll(async () => {
    // Verificar conexión
    const prisma = getTestPrisma();
    await prisma.$queryRaw`SELECT 1`;
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });
}

/**
 * Configura hooks estándar para tests de integración con Redis.
 * Limpia Redis antes de cada test para aislamiento.
 */
export function useRedisIsolation(): void {
  beforeAll(async () => {
    // Verificar conexión
    await getTestRedis();
  });

  beforeEach(async () => {
    await cleanRedis();
  });

  afterAll(async () => {
    await disconnectRedis();
  });
}

/**
 * Configura hooks para tests que necesitan tanto DB como Redis.
 */
export function useFullIsolation(): void {
  beforeAll(async () => {
    const prisma = getTestPrisma();
    await prisma.$queryRaw`SELECT 1`;
    await getTestRedis();
  });

  beforeEach(async () => {
    await Promise.all([cleanDatabase(), cleanRedis()]);
  });

  afterAll(async () => {
    await Promise.all([disconnectPrisma(), disconnectRedis()]);
  });
}

/**
 * Genera un ID único para cada test, útil para fixtures aislados.
 */
export function useTestId(): { getTestId: () => string } {
  let testId = "";

  beforeEach(() => {
    testId = uuidv4();
  });

  return {
    getTestId: () => testId,
  };
}
