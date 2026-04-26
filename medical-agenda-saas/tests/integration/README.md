# Integration Tests

Sistema de tests de integración endurecido para ejecutar contra PostgreSQL y Redis locales.

## Requisitos

1. **PostgreSQL** corriendo en `localhost:5432`
2. **Redis** corriendo en `localhost:6379`
3. Node.js 18+

## Quick Start

```bash
# 1. Verificar servicios están corriendo
# Windows:
net start postgresql-x64-15
redis-server

# Linux/Mac:
sudo systemctl start postgresql
brew services start redis

# 2. Configurar variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/test_db"
export REDIS_URL="redis://localhost:6379"

# 3. Ejecutar tests
npm run test:integration
```

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | URL de PostgreSQL | Requerido |
| `REDIS_URL` | URL de Redis | `redis://localhost:6379` |
| `TEST_RUN_ID` | UUID para aislamiento | Auto-generado |
| `ENABLE_LOCAL_INFRA_BOOTSTRAP` | Auto-iniciar servicios (solo dev) | `false` |
| `INFRA_STRICT_MODE` | Abortar si infra falla | `true` |
| `INFRA_LOG_LEVEL` | Nivel de logging | `info` |

## Modo Estricto

Por defecto, los tests abortan completamente si:
- PostgreSQL no está disponible
- Redis no está disponible
- La configuración es inválida

**NO se permiten skips ni degradación silenciosa.**

## Auto-Bootstrap (Solo Desarrollo)

En desarrollo, puedes habilitar el auto-inicio de servicios:

```bash
export ENABLE_LOCAL_INFRA_BOOTSTRAP=true
npm run test:integration
```

⚠️ **PROHIBIDO en producción**

## Aislamiento de Tests

Cada ejecución de tests usa un `TEST_RUN_ID` único:

```
test:{TEST_RUN_ID}:user:123
test:{TEST_RUN_ID}:bull:queue:...
```

Esto permite:
- Tests paralelos sin colisiones
- Limpieza selectiva por namespace
- Debugging de tests fallidos

## Ejecutar Tests

```bash
# Todos los tests de integración
npm run test:integration

# Solo tests de Redis
npm run test:integration -- --grep "Redis"

# Solo tests de brain flow
npm run test:brain

# Solo tests de workers
npm run test:workers

# Modo watch (desarrollo)
npm run test:integration:watch
```

## Archivos de Test

| Archivo | Descripción |
|---------|-------------|
| `global-setup.ts` | Setup estricto de infraestructura |
| `test-isolation.ts` | Utilidades de aislamiento |
| `redis-real.test.ts` | Tests obligatorios de Redis |
| `brain-flow.test.ts` | Flujo completo de mensajes WhatsApp |
| `worker-pipeline.test.ts` | Pipeline de workers escalados |

## Flujo de Ejecución

```
┌─────────────────────────────────────────────────────────────┐
│                     npm run test:integration                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      global-setup.ts                        │
│  1. Genera TEST_RUN_ID único                                │
│  2. [Opcional] Auto-bootstrap de servicios                  │
│  3. Valida infraestructura (STRICT MODE)                    │
│  4. Ejecuta migraciones Prisma                              │
│  5. Configura timeouts y logging                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tests Ejecutándose                       │
│  - Cada test usa namespace aislado                          │
│  - cleanRedis() limpia solo su namespace                    │
│  - Timeouts controlados (30s test, 2s Redis, 3s DB)         │
│  - DB y Redis son LOCALES, no mocks                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      global-teardown                        │
│  - Cleanup de namespace del test run                        │
│  - Infraestructura local persiste                           │
└─────────────────────────────────────────────────────────────┘
```

## Módulo de Infraestructura (@/lib/infra)

### Redis Health Check

```typescript
import { ensureRedisAvailable, requireRedis } from '@/lib/infra';

// Verificar disponibilidad
const result = await ensureRedisAvailable();
if (!result.available) {
  console.error(result.error);
}

// Fail-fast si no está disponible
await requireRedis(); // throws si falla
```

### Aislamiento Redis

```typescript
import { createIsolatedRedis, withIsolatedRedis } from '@/lib/infra';

// Crear cliente aislado
const client = await createIsolatedRedis();
await client.redis.set(client.prefixKey('user:1'), 'data');
await client.cleanup(); // Solo limpia su namespace

// O usar wrapper automático
await withIsolatedRedis(async (client) => {
  await client.redis.set(client.prefixKey('key'), 'value');
}); // cleanup automático
```

### BullMQ Hardening

```typescript
import {
  waitUntilQueueReady,
  waitUntilWorkerReady,
  waitForJobCompletion,
} from '@/lib/infra';

// Verificar cola lista
const ready = await waitUntilQueueReady(queue, 5000);

// Verificar worker procesando
await waitUntilWorkerReady(worker);

// Esperar job complete
const result = await waitForJobCompletion(queue, jobId, 10000);
expect(result.completed).toBe(true);
```

### Timeouts Controlados

```typescript
import { withTimeout, withRetry, TIMEOUTS } from '@/lib/infra';

// Operación con timeout
const result = await withTimeout(
  () => redis.ping(),
  TIMEOUTS.REDIS_PING,
  'Redis ping'
);

// Operación con reintentos
const conn = await withRetry(
  () => connect(),
  { maxAttempts: 3, timeoutPerAttempt: 2000 }
);
```

## Troubleshooting

### Redis no está disponible

```bash
# Windows
redis-server

# Linux
sudo systemctl start redis-server

# Mac
brew services start redis
```

### PostgreSQL no acepta conexiones

```bash
# Verificar servicio
psql -h localhost -p 5432 -U postgres -c "SELECT 1"

# Crear base de datos de test
createdb test_db
```

### Tests colgados

Los tests tienen timeouts estrictos:
- Test: 30 segundos
- Setup/teardown: 15 segundos
- Redis operations: 2 segundos
- DB operations: 3 segundos

### Contaminación entre tests

Los tests usan namespaces aislados (`TEST_RUN_ID`).
Si ves datos "fantasma", verifica que:

1. `cleanRedis()` se llama en `beforeEach`
2. El `TEST_RUN_ID` es único por ejecución
3. No hay tests que usen claves sin prefijo

### Diagnóstico Detallado

Si los tests fallan en setup, se genera un reporte automático:

```
═══════════════════════════════════════════════════════════════════
                    INFRASTRUCTURE DIAGNOSTIC REPORT
═══════════════════════════════════════════════════════════════════

Configuration:
  DATABASE_URL: ✓ set
  REDIS_URL: redis://localhost:6379 (default)
  NODE_ENV: test

Connectivity:
  PostgreSQL: AVAILABLE (45ms)
  Redis: UNAVAILABLE
    Error: Redis no esta disponible en localhost:6379

═══════════════════════════════════════════════════════════════════
```
```

## Agregar Nuevos Tests

```typescript
import {
  getTestPrisma,
  getTestRedis,
  cleanDatabase,
  disconnectPrisma,
  disconnectRedis,
} from "./test-isolation";

describe("Mi Test", () => {
  beforeAll(async () => {
    const prisma = getTestPrisma();
    await prisma.$queryRaw`SELECT 1`;
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("hace algo con la DB real", async () => {
    const prisma = getTestPrisma();
    // ... test con DB real
  });
});
```

## Diferencia con Tests Unitarios

| Aspecto | Unitarios | Integración |
|---------|-----------|-------------|
| Velocidad | Rápidos (ms) | Moderados (s) |
| Infraestructura | Mocks | Local real |
| Aislamiento | Por test | Por test (cleanup) |
| Uso | Lógica de negocio | Flujos completos |
| Comando | `npm test` | `npm run test:integration` |
