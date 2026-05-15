import { Injectable, Logger } from '@nestjs/common';
import { MetaBrainClient, MetaBrainResponse } from './metabrain.client.js';
import { mapToMetaBrainEvent, RawGSentinelEvent } from './event.mapper.js';

export interface HandlerResult {
  /** The raw MetaBrain response (or synthesised fallback). */
  response: MetaBrainResponse;
  /** Whether the caller should proceed with execution. Always false in shadow mode. */
  shouldExecute: boolean;
  /** Original event kept for traceability. */
  originalEvent: RawGSentinelEvent;
}

/**
 * Shadow mode controls whether GSentinelHealthOS may execute MetaBrain actions.
 *
 * SHADOW_MODE=true  → decisions are logged only, nothing is executed.
 * SHADOW_MODE=false → only EXECUTED decisions trigger execution.
 *
 * Start in shadow mode; flip the env var when confidence is established.
 */
function isShadowMode(): boolean {
  return process.env.METABRAIN_SHADOW_MODE !== 'false';
}

@Injectable()
export class MetaBrainHandler {
  private readonly logger = new Logger(MetaBrainHandler.name);
  private readonly shadowMode: boolean;

  constructor(private readonly client: MetaBrainClient) {
    this.shadowMode = isShadowMode();
    this.logger.log(
      `[MetaBrainHandler] Initialized — shadow_mode=${this.shadowMode}. ` +
        (this.shadowMode
          ? 'Actions will be LOGGED ONLY. Set METABRAIN_SHADOW_MODE=false to enable execution.'
          : 'Live mode: EXECUTED decisions will be passed to the execution layer.'),
    );
  }

  /**
   * Central entry point for all GSentinelHealthOS events.
   *
   * Pipeline:
   *   1. Normalise raw event → MetaBrainEvent (event.mapper)
   *   2. Send to MetaBrain API  (metabrain.client)
   *   3. Validate response schema
   *   4. Apply shadow-mode gate
   *   5. Structured traceability log
   *   6. Return HandlerResult to caller
   */
  async handle(rawEvent: RawGSentinelEvent): Promise<HandlerResult> {
    const mappedEvent = mapToMetaBrainEvent(rawEvent);

    // ── Traceability: outgoing event ──────────────────────────────────────────
    this.logger.log(
      `[Trace] → MetaBrain id=${mappedEvent.id} type=${mappedEvent.type} source=${mappedEvent.source}`,
    );

    const response = await this.client.sendIncident(mappedEvent);

    // ── Traceability: full trace record ────────────────────────────────────────
    this.logTrace(rawEvent, mappedEvent.id, response);

    // ── Execution gate ─────────────────────────────────────────────────────────
    const shouldExecute = this.resolveExecution(response);

    return { response, shouldExecute, originalEvent: rawEvent };
  }

  /**
   * Only return true when MetaBrain explicitly says EXECUTED AND
   * shadow mode is disabled.
   *
   * Any other status (SUCCESS, BLOCKED, FALLBACK, SIMULATED) → no execution.
   * This is intentional: the consumer is responsible for calling its own
   * execution layer only when shouldExecute === true.
   */
  private resolveExecution(response: MetaBrainResponse): boolean {
    if (this.shadowMode) {
      this.logger.log(
        `[MetaBrainHandler] Shadow mode: action="${response.action ?? 'none'}" status=${response.status} — NOT executed`,
      );
      return false;
    }

    if (response.status !== 'EXECUTED') {
      this.logger.log(
        `[MetaBrainHandler] status=${response.status} reason="${response.reason}" — no execution`,
      );
      return false;
    }

    this.logger.log(
      `[MetaBrainHandler] EXECUTED action="${response.action}" — forwarding to execution layer`,
    );
    return true;
  }

  private logTrace(
    originalEvent: RawGSentinelEvent,
    metaBrainId: string,
    response: MetaBrainResponse,
  ): void {
    // Never log the raw Authorization header or any API key material.
    // Redact tenantId from full trace if needed, but keep it for audit.
    const traceRecord = {
      traceId: metaBrainId,
      originalEventId: originalEvent.id ?? null,
      source: originalEvent.source ?? null,
      metabrain: {
        status: response.status,
        action: response.action,
        reason: response.reason,
        // execution details only when present (avoids null noise in logs)
        ...(response.execution !== null && { execution: response.execution }),
      },
      shadowMode: this.shadowMode,
      ts: new Date().toISOString(),
    };

    if (response.status === 'FALLBACK') {
      this.logger.warn(`[Trace] MetaBrain FALLBACK — ${JSON.stringify(traceRecord)}`);
    } else if (response.status === 'BLOCKED') {
      this.logger.warn(`[Trace] MetaBrain BLOCKED — ${JSON.stringify(traceRecord)}`);
    } else {
      this.logger.log(`[Trace] MetaBrain response — ${JSON.stringify(traceRecord)}`);
    }
  }
}
