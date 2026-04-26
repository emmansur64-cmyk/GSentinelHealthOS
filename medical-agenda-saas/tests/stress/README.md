# Sistema de Stress Testing - Agenda Médica

Sistema completo de stress testing para validar el comportamiento de la agenda médica inteligente bajo carga concurrente de 100-500 mensajes WhatsApp.

## Componentes

```
tests/stress/
├── index.ts                 # Exportaciones centrales
├── load-generator.ts        # Generación de mensajes realistas
├── metrics-collector.ts     # Recolección de latencia/throughput
├── consistency-validator.ts # Validación de integridad de datos
├── critical-concurrency.ts  # Test de 50 usuarios → 1 slot
├── failure-detector.ts      # Detección y clasificación de fallos
├── stress-runner.ts         # Orquestador principal
├── stress.test.ts           # Suite de tests vitest
└── README.md                # Este archivo
```

## Quick Start

### 1. Ejecutar tests unitarios

```bash
npm run test tests/stress/stress.test.ts
```

### 2. Ejecutar stress test rápido (100 mensajes)

```bash
# Variables de entorno
export WEBHOOK_URL="http://localhost:3000/api/webhook/whatsapp"
export WEBHOOK_TOKEN="your_webhook_token"
export DOCTOR_IDS="doc1,doc2"
export DOCTOR_NAMES='{"doc1":"Dr. García","doc2":"Dra. López"}'

# Ejecutar
npx tsx tests/stress/stress-runner.ts
```

### 3. Ejecutar stress test completo (500 mensajes + concurrencia crítica)

```bash
npx tsx tests/stress/stress-runner.ts --full
```

### 4. Ejecutar tests de integración

```bash
# Activa los tests de integración
export RUN_STRESS_INTEGRATION=true
npm run test tests/stress/stress.test.ts
```

### 5. Ejecutar test de concurrencia crítica

```bash
# Activa el test de 50 usuarios intentando reservar el mismo slot
export RUN_CRITICAL_CONCURRENCY=true
npm run test tests/stress/stress.test.ts
```

## API Programática

```typescript
import {
  runQuickStressTest,
  runFullStressTest,
  assertStressTestPassed,
} from "./tests/stress";

// Test rápido
const result = await runQuickStressTest({
  webhookUrl: "http://localhost:3000/api/webhook/whatsapp",
  webhookToken: "your_token",
  doctorIds: ["doc1", "doc2"],
  doctorNames: { doc1: "Dr. García", doc2: "Dra. López" },
  messages: 100,
  concurrency: 10,
});

// Validar resultado
assertStressTestPassed(result);

// Test completo con concurrencia crítica
const fullResult = await runFullStressTest({
  webhookUrl: "http://localhost:3000/api/webhook/whatsapp",
  webhookToken: "your_token",
  doctorIds: ["doc1"],
  doctorNames: { doc1: "Dr. García" },
  messages: 500,
  concurrency: 50,
});
```

## Criterios de Fallo

| Métrica | Umbral | Descripción |
|---------|--------|-------------|
| Error Rate | > 2% | Porcentaje de requests fallidos |
| Duplicates | > 0 | Turnos duplicados (mismo paciente + doctor + horario) |
| Overlaps | > 0 | Turnos solapados para el mismo doctor |
| P95 Latency | > 2000ms | Latencia del percentil 95 |
| Race Condition | > 0 | Más de 1 turno creado para el mismo slot |

## Escenarios de Test

### 1. Carga Normal (100 mensajes)

Simula carga típica de producción con distribución realista:
- 70% crear turno
- 15% reprogramar
- 10% cancelar
- 5% consultar disponibilidad

### 2. Carga Alta (500 mensajes)

Simula pico de demanda con 50 requests concurrentes.

### 3. Concurrencia Crítica

**Escenario**: 50 usuarios intentan reservar el mismo horario simultáneamente.

**Resultado esperado**:
- ✅ Solo 1 turno creado
- ✅ 49 usuarios reciben rechazo con motivo "slot_occupied"
- ✅ Sin duplicados ni solapamientos
- ✅ Idempotencia respetada

## Métricas Recolectadas

### Latencia
- **P50**: Mediana
- **P95**: Percentil 95 (target < 2s)
- **P99**: Percentil 99 (target < 5s)
- **Avg**: Promedio

### Throughput
- Mensajes por segundo
- Requests exitosos vs fallidos

### Consistencia
- Turnos duplicados
- Solapamientos de horario
- Violaciones de idempotencia
- Registros huérfanos

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `WEBHOOK_URL` | URL del webhook WhatsApp | `http://localhost:3000/api/webhook/whatsapp` |
| `WEBHOOK_TOKEN` | Token de verificación | `test_token` |
| `DOCTOR_IDS` | IDs de doctores (comma-separated) | `doc1,doc2` |
| `DOCTOR_NAMES` | JSON con nombres de doctores | `{"doc1":"Dr. García"}` |
| `STRESS_MESSAGES` | Número de mensajes | `100` |
| `STRESS_CONCURRENCY` | Concurrencia máxima | `10` |
| `RUN_STRESS_INTEGRATION` | Habilita tests de integración | `false` |
| `RUN_CRITICAL_CONCURRENCY` | Habilita test de concurrencia | `false` |
| `RUN_FULL_STRESS` | Habilita test completo | `false` |

## Ejemplo de Output

```
╔══════════════════════════════════════════════════════════════════╗
║                     STRESS TEST RUNNER                           ║
╠══════════════════════════════════════════════════════════════════╣
║  Test: Quick Stress Test                                         ║
║  Total Messages: 100                                             ║
║  Concurrency: 10                                                 ║
╚══════════════════════════════════════════════════════════════════╝

[1/5] Generating load...
      Generated 100 messages
[2/5] Sending messages...
      Progress: 100/100 (100%)
      Sent: 100, Success: 98, Failed: 2
[3/5] Waiting for queue processing (10s)...
[4/5] Skipping critical concurrency test
[5/5] Validating consistency...

═══════════════════════════════════════════════════════════════════
                 METRICS REPORT
═══════════════════════════════════════════════════════════════════
  Total Requests:    100
  Success:           98 (98.00%)
  Errors:            2 (2.00%)
  
  Latency:
    P50:             145ms
    P95:             823ms
    P99:             1234ms
    Avg:             201ms
═══════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════
                 CONSISTENCY VALIDATION REPORT
═══════════════════════════════════════════════════════════════════
SUMMARY
  Total Appointments:      42
  Duplicate Appointments:  0
  Overlapping Slots:       0
  Idempotency Violations:  0

CHECKS
  [PASS] No duplicate appointments
  [PASS] No overlapping slots
  [PASS] Message idempotency
  [PASS] Referential integrity
  [PASS] Consistent states

  OVERALL RESULT: VALID
═══════════════════════════════════════════════════════════════════

╔══════════════════════════════════════════════════════════════════╗
║                    FINAL TEST RESULT                             ║
╠══════════════════════════════════════════════════════════════════╣
║  Test: Quick Stress Test                                         ║
║  Duration: 23.4s                                                 ║
║  Throughput: 4.3 msg/s                                           ║
╠══════════════════════════════════════════════════════════════════╣
║  Messages: 100 sent, 98 ok, 2 failed                             ║
║  Error Rate: 2.00%                                               ║
║  Latency P95: 823ms                                              ║
╠══════════════════════════════════════════════════════════════════╣
║  Consistency: PASS                                               ║
║  Duplicates: 0                                                   ║
║  Overlaps: 0                                                     ║
╠══════════════════════════════════════════════════════════════════╣
║  STATUS: PASSED                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

## Integración con CI/CD

```yaml
# .github/workflows/stress-test.yml
name: Stress Tests

on:
  schedule:
    - cron: '0 3 * * *'  # Diario a las 3am
  workflow_dispatch:

jobs:
  stress-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: medical_agenda_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Start application
        run: npm run dev &
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/medical_agenda_test
          
      - name: Wait for app
        run: npx wait-on http://localhost:3000/api/health
        
      - name: Run stress tests
        run: npm run test:stress
        env:
          RUN_STRESS_INTEGRATION: true
          RUN_CRITICAL_CONCURRENCY: true
          WEBHOOK_URL: http://localhost:3000/api/webhook/whatsapp
```

## Troubleshooting

### Error: "Connection refused"
Asegúrate de que el servidor está corriendo en `WEBHOOK_URL`.

### Error: "Invalid signature"
Verifica que `WEBHOOK_TOKEN` coincide con la configuración del servidor.

### Muchos timeouts
- Aumenta `requestTimeoutMs` en la configuración
- Verifica capacidad del servidor y base de datos
- Revisa logs del servidor para cuellos de botella

### Race conditions detectadas
- Implementa locking optimista o pesimista en booking
- Usa `SERIALIZABLE` isolation level para transacciones críticas
- Revisa índices únicos en la base de datos
