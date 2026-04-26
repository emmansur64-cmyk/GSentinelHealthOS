import { context, trace, SpanStatusCode, SpanKind, type Attributes } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

import { getObservabilityContext } from "@/lib/observability/context";

let initialized = false;

export function initTracing(): void {
  if (initialized) return;

  const spanProcessors: BatchSpanProcessor[] = [];
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();

  if (endpoint) {
    const exporter = new OTLPTraceExporter({ url: endpoint.replace(/\/$/, "") + "/v1/traces" });
    spanProcessors.push(new BatchSpanProcessor(exporter));
  } else if (process.env.NODE_ENV !== "production") {
    spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()));
  }

  const provider = new NodeTracerProvider({ spanProcessors });

  provider.register();
  initialized = true;
}

export function getTracer() {
  initTracing();
  return trace.getTracer("medical-agenda-observability", "1.0.0");
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T>,
  kind: SpanKind = SpanKind.INTERNAL,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, { kind, attributes }, async (span) => {
    const ctx = getObservabilityContext();
    if (ctx?.traceId) {
      span.setAttribute("app.trace_id", ctx.traceId);
    }

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : "unknown" });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function getCurrentTraceIdFromSpan(): string | null {
  const activeSpan = trace.getSpan(context.active());
  if (!activeSpan) return null;
  const spanContext = activeSpan.spanContext();
  return spanContext.traceId || null;
}
