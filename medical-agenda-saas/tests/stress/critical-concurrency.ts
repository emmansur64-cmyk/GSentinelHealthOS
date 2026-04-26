/**
 * Critical Concurrency Test
 *
 * Test específico para validar el comportamiento bajo condiciones de
 * concurrencia extrema: 50+ usuarios intentando reservar el mismo slot.
 *
 * Expectativa: Solo 1 turno creado, resto rechazado correctamente.
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import {
  validateSingleSlotWinner,
  ConsistencyValidator,
} from "./consistency-validator";
import { generateConcurrentSlotConflict, type MessageIntent, type GeneratedMessage } from "./load-generator";
import { MetricsCollector, type RequestResult } from "./metrics-collector";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CriticalConcurrencyConfig {
  /** Número de usuarios concurrentes */
  concurrentUsers: number;

  /** Hora objetivo para el turno (debe ser futura) */
  targetDateTime: Date;

  /** ID del doctor objetivo */
  doctorId: string;

  /** Nombre visible del doctor */
  doctorName: string;

  /** URL del webhook */
  webhookUrl: string;

  /** Webhook verify token para firma */
  webhookToken: string;

  /** Delay máximo entre envíos (ms) para simular condiciones reales */
  jitterMs?: number;

  /** Timeout total de la prueba (ms) */
  timeoutMs?: number;
}

export interface CriticalConcurrencyResult {
  success: boolean;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    rejectedRequests: number;
    errorRequests: number;
    appointmentsCreated: number;
    durationMs: number;
  };
  validation: {
    singleWinner: boolean;
    noOverlaps: boolean;
    idempotencyRespected: boolean;
  };
  details: {
    winnerPatientId?: string;
    rejectionReasons: Record<string, number>;
    errors: string[];
  };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function generateUniquePhone(): string {
  // Genera números de teléfono únicos en formato WhatsApp
  const prefix = "521"; // México
  const number = Math.floor(1000000000 + Math.random() * 9000000000);
  return `${prefix}${number}`;
}

function formatDateTimeNatural(date: Date): string {
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const dia = dias[date.getDay()];
  const numeroDia = date.getDate();
  const mes = meses[date.getMonth()];
  const hora = date.getHours();
  const minutos = date.getMinutes().toString().padStart(2, "0");

  return `${dia} ${numeroDia} de ${mes} a las ${hora}:${minutos}`;
}

// ─── Critical Concurrency Runner ─────────────────────────────────────────────

export class CriticalConcurrencyRunner {
  private config: Required<CriticalConcurrencyConfig>;
  private prisma: PrismaClient;
  private metricsCollector: MetricsCollector;

  constructor(config: CriticalConcurrencyConfig, prisma: PrismaClient) {
    this.config = {
      jitterMs: config.jitterMs ?? 50,
      timeoutMs: config.timeoutMs ?? 60000,
      ...config,
    };
    this.prisma = prisma;
    this.metricsCollector = new MetricsCollector();
  }

  async run(): Promise<CriticalConcurrencyResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const rejectionReasons: Record<string, number> = {};

    console.log("\n");
    console.log("══════════════════════════════════════════════════════════");
    console.log("       CRITICAL CONCURRENCY TEST");
    console.log("══════════════════════════════════════════════════════════");
    console.log(`  Concurrent Users:  ${this.config.concurrentUsers}`);
    console.log(`  Target DateTime:   ${this.config.targetDateTime.toISOString()}`);
    console.log(`  Doctor:            ${this.config.doctorName}`);
    console.log("══════════════════════════════════════════════════════════\n");

    // Generar mensajes para todos los usuarios concurrentes
    const messages = this.generateConcurrentMessages();

    console.log(`Generated ${messages.length} concurrent booking requests`);

    // Enviar todos los mensajes simultáneamente
    const results = await this.sendConcurrentRequests(messages);

    // Analizar resultados
    let successCount = 0;
    let rejectedCount = 0;
    let errorCount = 0;

    for (const result of results) {
      if (result.success) {
        if (result.isRejection) {
          rejectedCount++;
          const reason = result.rejectionReason || "unknown";
          rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
        } else {
          successCount++;
        }
      } else {
        errorCount++;
        if (result.error) {
          errors.push(result.error);
        }
      }
    }

    // Esperar procesamiento de cola (dar tiempo al sistema para procesar)
    console.log("\nWaiting for queue processing (5s)...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Validar consistencia
    const slotValidation = await validateSingleSlotWinner(
      this.prisma,
      this.config.doctorId,
      this.config.targetDateTime,
    );

    const consistencyValidator = new ConsistencyValidator(this.prisma);
    const consistencyReport = await consistencyValidator.validate();

    const durationMs = Date.now() - startTime;

    const result: CriticalConcurrencyResult = {
      success:
        slotValidation.valid &&
        consistencyReport.summary.duplicateAppointments === 0 &&
        consistencyReport.summary.overlappingSlots === 0,
      metrics: {
        totalRequests: messages.length,
        successfulRequests: successCount,
        rejectedRequests: rejectedCount,
        errorRequests: errorCount,
        appointmentsCreated: slotValidation.appointmentCount,
        durationMs,
      },
      validation: {
        singleWinner: slotValidation.valid,
        noOverlaps: consistencyReport.summary.overlappingSlots === 0,
        idempotencyRespected:
          consistencyReport.summary.idempotencyViolations === 0,
      },
      details: {
        winnerPatientId: slotValidation.appointments[0]?.patientId,
        rejectionReasons,
        errors: errors.slice(0, 10), // Limitar a primeros 10 errores
      },
    };

    this.printResults(result);

    return result;
  }

  private generateConcurrentMessages(): Array<{
    phone: string;
    body: string;
    messageId: string;
  }> {
    const dateStr = formatDateTimeNatural(this.config.targetDateTime);

    const messageTemplates = [
      `Quiero un turno con ${this.config.doctorName} el ${dateStr}`,
      `Reservar cita con ${this.config.doctorName} para el ${dateStr}`,
      `Necesito turno el ${dateStr} con ${this.config.doctorName}`,
      `Agendar consulta ${dateStr} doctor ${this.config.doctorName}`,
      `Hola, quisiera sacar turno el ${dateStr}`,
    ];

    return Array.from({ length: this.config.concurrentUsers }, (_, i) => ({
      phone: generateUniquePhone(),
      body: messageTemplates[i % messageTemplates.length],
      messageId: `wamid.stress_critical_${Date.now()}_${i}_${crypto.randomBytes(4).toString("hex")}`,
    }));
  }

  private async sendConcurrentRequests(
    messages: Array<{ phone: string; body: string; messageId: string }>,
  ): Promise<
    Array<{
      success: boolean;
      isRejection?: boolean;
      rejectionReason?: string;
      error?: string;
    }>
  > {
    const requests = messages.map((msg, index) =>
      this.sendSingleRequest(msg, index),
    );

    return Promise.all(requests);
  }

  private async sendSingleRequest(
    msg: { phone: string; body: string; messageId: string },
    index: number,
  ): Promise<{
    success: boolean;
    isRejection?: boolean;
    rejectionReason?: string;
    error?: string;
  }> {
    // Pequeño jitter para simular condiciones reales
    if (this.config.jitterMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * this.config.jitterMs),
      );
    }

    const payload = this.buildWhatsAppPayload(msg);
    const signature = this.generateSignature(payload);
    const startTime = performance.now();

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": `sha256=${signature}`,
        },
        body: payload,
      });

      const endTime = performance.now();
      this.metricsCollector.recordRequest({
        messageId: msg.messageId,
        startTime,
        endTime,
        latencyMs: endTime - startTime,
        statusCode: response.status,
        success: response.ok,
      });

      if (!response.ok) {
        const body = await response.text();

        // Detectar si es un rechazo legítimo por slot ocupado
        if (response.status === 409 || body.includes("slot_occupied")) {
          return {
            success: true,
            isRejection: true,
            rejectionReason: "slot_occupied",
          };
        }

        if (body.includes("duplicate") || response.status === 422) {
          return {
            success: true,
            isRejection: true,
            rejectionReason: "duplicate_request",
          };
        }

        return {
          success: false,
          error: `HTTP ${response.status}: ${body.substring(0, 100)}`,
        };
      }

      const responseData = (await response.json()) as {
        rejected?: boolean;
        reason?: string;
      };

      // Verificar respuesta para determinar si fue aceptado o rechazado
      if (responseData.rejected) {
        return {
          success: true,
          isRejection: true,
          rejectionReason: responseData.reason || "unknown",
        };
      }

      return { success: true };
    } catch (error) {
      const endTime = performance.now();
      this.metricsCollector.recordRequest({
        messageId: msg.messageId,
        startTime,
        endTime,
        latencyMs: endTime - startTime,
        statusCode: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildWhatsAppPayload(msg: {
    phone: string;
    body: string;
    messageId: string;
  }): string {
    return JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "BUSINESS_ACCOUNT_ID",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "15551234567",
                  phone_number_id: "PHONE_NUMBER_ID",
                },
                contacts: [
                  {
                    profile: { name: `StressUser_${msg.phone.slice(-4)}` },
                    wa_id: msg.phone,
                  },
                ],
                messages: [
                  {
                    from: msg.phone,
                    id: msg.messageId,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: { body: msg.body },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    });
  }

  private generateSignature(payload: string): string {
    return crypto
      .createHmac("sha256", this.config.webhookToken)
      .update(payload)
      .digest("hex");
  }

  private printResults(result: CriticalConcurrencyResult): void {
    console.log("\n");
    console.log("══════════════════════════════════════════════════════════");
    console.log("       CRITICAL CONCURRENCY TEST RESULTS");
    console.log("══════════════════════════════════════════════════════════");
    console.log("");
    console.log("METRICS");
    console.log("──────────────────────────────────────────────────────────");
    console.log(`  Total Requests:        ${result.metrics.totalRequests}`);
    console.log(`  Successful Requests:   ${result.metrics.successfulRequests}`);
    console.log(`  Rejected Requests:     ${result.metrics.rejectedRequests}`);
    console.log(`  Error Requests:        ${result.metrics.errorRequests}`);
    console.log(`  Appointments Created:  ${result.metrics.appointmentsCreated}`);
    console.log(`  Duration:              ${result.metrics.durationMs}ms`);
    console.log("");
    console.log("VALIDATION");
    console.log("──────────────────────────────────────────────────────────");
    console.log(
      `  Single Winner:         ${result.validation.singleWinner ? "PASS" : "FAIL"}`,
    );
    console.log(
      `  No Overlaps:           ${result.validation.noOverlaps ? "PASS" : "FAIL"}`,
    );
    console.log(
      `  Idempotency:           ${result.validation.idempotencyRespected ? "PASS" : "FAIL"}`,
    );
    console.log("");

    if (result.details.winnerPatientId) {
      console.log("WINNER");
      console.log("──────────────────────────────────────────────────────────");
      console.log(`  Patient ID:            ${result.details.winnerPatientId}`);
    }

    if (Object.keys(result.details.rejectionReasons).length > 0) {
      console.log("");
      console.log("REJECTION REASONS");
      console.log("──────────────────────────────────────────────────────────");
      for (const [reason, count] of Object.entries(
        result.details.rejectionReasons,
      )) {
        console.log(`  ${reason}: ${count}`);
      }
    }

    if (result.details.errors.length > 0) {
      console.log("");
      console.log("ERRORS (first 10)");
      console.log("──────────────────────────────────────────────────────────");
      for (const error of result.details.errors) {
        console.log(`  - ${error}`);
      }
    }

    console.log("");
    console.log("══════════════════════════════════════════════════════════");
    console.log(
      `       OVERALL: ${result.success ? "PASS - Only 1 appointment created" : "FAIL - Race condition detected!"}`,
    );
    console.log("══════════════════════════════════════════════════════════");
    console.log("");
  }
}

// ─── Quick Run Function ──────────────────────────────────────────────────────

/**
 * Ejecuta una prueba de concurrencia crítica rápida.
 */
export async function runCriticalConcurrencyTest(options: {
  webhookUrl: string;
  webhookToken: string;
  doctorId: string;
  doctorName: string;
  concurrentUsers?: number;
  hoursFromNow?: number;
}): Promise<CriticalConcurrencyResult> {
  const prisma = new PrismaClient();

  try {
    // Calcular fecha/hora objetivo (por defecto: mañana a las 10:00)
    const targetDateTime = new Date();
    targetDateTime.setDate(
      targetDateTime.getDate() + (options.hoursFromNow ? 0 : 1),
    );
    if (options.hoursFromNow) {
      targetDateTime.setTime(
        targetDateTime.getTime() + options.hoursFromNow * 60 * 60 * 1000,
      );
    } else {
      targetDateTime.setHours(10, 0, 0, 0);
    }

    const runner = new CriticalConcurrencyRunner(
      {
        concurrentUsers: options.concurrentUsers || 50,
        targetDateTime,
        doctorId: options.doctorId,
        doctorName: options.doctorName,
        webhookUrl: options.webhookUrl,
        webhookToken: options.webhookToken,
      },
      prisma,
    );

    return await runner.run();
  } finally {
    await prisma.$disconnect();
  }
}
