import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AiAnalysisResult, BrainDecision, IncidentPayload } from '../../common/types/brain.types';

type ModelError = 'SKIP' | 'FATAL';

interface GroqErrorBody {
  error?: { code?: string; type?: string; message?: string };
}

interface CircuitState {
  failures: number;
  openUntil: number;
}

const MODEL_TIMEOUT_MS = 4000;
const CIRCUIT_MAX_FAILURES = 5;
const CIRCUIT_COOLDOWN_MS = 60_000;
const CACHE_MAX_SIZE = 256;
const CACHE_TTL_MS = 5 * 60_000; // 5 min

interface CacheEntry {
  value: AiAnalysisResult;
  expiresAt: number;
}

function buildModelChain(): readonly string[] {
  const primary = process.env.GROQ_MODEL_PRIMARY?.trim() || 'mixtral-8x7b-32768';
  const secondary = process.env.GROQ_MODEL_SECONDARY?.trim() || 'llama3-8b-8192';
  return [...new Set([primary, secondary, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'])];
}

const AI_SAFE_FALLBACK: AiAnalysisResult = {
  rootCause: 'UNKNOWN',
  confidence: 0.1,
  source: 'ai_fallback',
};

export const MEDICAL_GROQ_PROVIDER = 'MEDICAL_GROQ_PROVIDER';

@Injectable()
export class GroqProvider {
  private readonly logger = new Logger(GroqProvider.name);
  private readonly apiKey: string | undefined;
  private readonly apiKeyEnvVar: string;
  private readonly modelChain: readonly string[];

  // Per-model circuit breaker state
  private readonly circuits = new Map<string, CircuitState>();

  // LRU-style bounded response cache (keyed by prompt SHA-256)
  private readonly cache = new Map<string, CacheEntry>();

  constructor(apiKeyEnvVar = 'GROQ_API_KEY') {
    this.apiKeyEnvVar = apiKeyEnvVar;
    this.apiKey = process.env[apiKeyEnvVar];
    this.modelChain = buildModelChain();
  }

  // ── Circuit breaker ──────────────────────────────────────────────────────────

  private isCircuitOpen(model: string): boolean {
    const state = this.circuits.get(model);
    if (!state) return false;
    if (state.openUntil > 0 && Date.now() < state.openUntil) return true;
    if (state.openUntil > 0 && Date.now() >= state.openUntil) {
      // half-open: reset so one probe is allowed
      state.failures = 0;
      state.openUntil = 0;
    }
    return false;
  }

  private recordFailure(model: string): void {
    const state = this.circuits.get(model) ?? { failures: 0, openUntil: 0 };
    state.failures += 1;
    if (state.failures >= CIRCUIT_MAX_FAILURES) {
      state.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
      this.logger.warn(`[CB] Circuit OPEN for model ${model} — cooling down ${CIRCUIT_COOLDOWN_MS / 1000}s`);
    }
    this.circuits.set(model, state);
  }

  private recordSuccess(model: string): void {
    this.circuits.delete(model);
  }

  // ── Cache ────────────────────────────────────────────────────────────────────

  private cacheKey(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex');
  }

  private cacheGet(key: string): AiAnalysisResult | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private cacheSet(key: string, value: AiAnalysisResult): void {
    if (this.cache.size >= CACHE_MAX_SIZE) {
      // evict oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  // ── Error classification ─────────────────────────────────────────────────────

  private classifyError(errorBody: string, status: number): ModelError {
    let parsed: GroqErrorBody = {};
    try { parsed = JSON.parse(errorBody) as GroqErrorBody; } catch { /* raw string */ }

    const code = parsed?.error?.code ?? '';
    const type = parsed?.error?.type ?? '';

    const skipCodes = ['model_decommissioned', 'model_not_found'];
    const skipTypes = ['invalid_request_error'];

    if (skipCodes.includes(code) || skipTypes.includes(type) || status === 404) return 'SKIP';
    return 'FATAL';
  }

  // ── Core HTTP call (with timeout) ────────────────────────────────────────────

  private async callModel(prompt: string, model: string): Promise<string> {
    const { default: fetch } = await import('node-fetch');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal as Parameters<typeof fetch>[1] extends { signal?: infer S } ? S : never,
        headers: {
          Authorization: `Bearer ${this.apiKey!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        }),
      });
    } catch (err) {
      clearTimeout(timer);
      const name = (err as Error)?.name;
      if (name === 'AbortError') {
        throw new Error(`GROQ_SKIP:${model}:timeout_${MODEL_TIMEOUT_MS}ms`);
      }
      throw err;
    }
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      const kind = this.classifyError(body, res.status);
      throw new Error(`GROQ_${kind}:${model}:${body.slice(0, 120)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error(`GROQ_SKIP:${model}:empty_response`);
    return content;
  }

  // ── Public: run (hint generation) ───────────────────────────────────────────

  async run(prompt: string): Promise<string> {
    if (!this.apiKey) throw new Error(`Missing ${this.apiKeyEnvVar}`);

    const attempted = new Set<string>();

    for (const model of this.modelChain) {
      if (attempted.has(model)) continue;
      if (this.isCircuitOpen(model)) {
        this.logger.warn(`[CB] Skipping model ${model} — circuit open`);
        continue;
      }
      attempted.add(model);

      try {
        const result = await this.callModel(prompt, model);
        this.recordSuccess(model);
        if (attempted.size > 1) {
          this.logger.warn(`[FALLBACK] Using model ${model} after ${attempted.size - 1} skipped`);
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('GROQ_SKIP:')) {
          this.recordFailure(model);
          this.logger.warn(`[AI] Model skipped (${model}): ${message.slice(10, 80)}`);
          continue;
        }
        this.recordFailure(model);
        this.logger.error(`[AI] Fatal error on model ${model}: ${message.slice(0, 120)}`);
        throw err;
      }
    }

    throw new Error('All AI models exhausted');
  }

  // ── Public: runAnalysis (with cache + circuit breaker + quality validation) ──

  async runAnalysis(prompt: string): Promise<AiAnalysisResult> {
    if (!this.apiKey) {
      this.logger.warn('[AI] No API key — returning safe fallback');
      return AI_SAFE_FALLBACK;
    }

    const key = this.cacheKey(prompt);
    const cached = this.cacheGet(key);
    if (cached) {
      this.logger.debug('[AI:cache] HIT — returning cached analysis');
      return cached;
    }

    const attempted = new Set<string>();

    for (const model of this.modelChain) {
      if (attempted.has(model)) continue;
      if (this.isCircuitOpen(model)) {
        this.logger.warn(`[CB] Skipping model ${model} — circuit open`);
        continue;
      }
      attempted.add(model);

      let raw: string;
      try {
        raw = await this.callModel(prompt, model);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.recordFailure(model);
        if (message.startsWith('GROQ_SKIP:')) {
          this.logger.warn(`[AI:analyze] Model skipped (${model}): ${message.slice(10, 60)}`);
          continue;
        }
        this.logger.error(`[AI:analyze] Fatal on model ${model}: ${message.slice(0, 120)}`);
        break;
      }

      try {
        const parsed = JSON.parse(raw) as Partial<AiAnalysisResult>;
        if (typeof parsed.rootCause === 'string' && typeof parsed.confidence === 'number') {
          const result: AiAnalysisResult = {
            rootCause: parsed.rootCause,
            confidence: parsed.confidence,
            source: model,
          };
          this.recordSuccess(model);
          this.cacheSet(key, result);
          if (attempted.size > 1) {
            this.logger.warn(`[AI:analyze] Valid response from fallback model: ${model}`);
          }
          return result;
        }
        this.recordFailure(model);
        this.logger.warn(`[AI:analyze] Invalid response shape from ${model}, trying next`);
      } catch {
        this.recordFailure(model);
        this.logger.warn(`[AI:analyze] Non-JSON response from ${model}, trying next`);
      }
    }

    this.logger.warn('[AI:analyze] All models failed — returning safe fallback');
    return AI_SAFE_FALLBACK;
  }

  async generateHint(input: IncidentPayload, decision: BrainDecision): Promise<string> {
    const prompt = `Incident ${input.id} from ${input.source}. Action=${decision.action}. Return one short ops hint.`;
    return this.run(prompt);
  }
}
