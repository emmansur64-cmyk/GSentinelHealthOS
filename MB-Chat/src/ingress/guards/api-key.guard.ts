import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Authenticates requests via `Authorization: Bearer <token>`.
 *
 * Multi-key support (rotation):
 *   Set METABRAIN_API_KEYS=key1,key2,key3  (comma-separated)
 *   A new key can be added alongside the old one, deployed, then the old key removed
 *   without downtime.  Falls back to METABRAIN_API_KEY for single-key deployments.
 *
 * Per-key rate limiting:
 *   Each key is independently limited to RATE_MAX requests per RATE_WINDOW_MS.
 *   This prevents a compromised / noisy client from saturating the system even when
 *   the global brain-level rate limit would otherwise pass.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  /** Sliding window length in ms. */
  private static readonly RATE_WINDOW_MS = 1_000;
  /** Max requests per key per window. */
  private static readonly RATE_MAX = 5;
  /** Chars of each key stored as the bucket identifier (never logged in full). */
  private static readonly FINGERPRINT_LEN = 8;

  private readonly logger = new Logger(ApiKeyGuard.name);
  /** All currently-valid keys. More than one = rotation mode. */
  private readonly validKeys: string[];
  /** Per-key sliding-window buckets: fingerprint → timestamps[]. */
  private readonly buckets = new Map<string, number[]>();

  constructor() {
    const multi = process.env.METABRAIN_API_KEYS;
    const single = process.env.METABRAIN_API_KEY;

    if (multi) {
      this.validKeys = multi
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      this.logger.log(
        `[Auth] Loaded ${this.validKeys.length} API key(s) from METABRAIN_API_KEYS (rotation ${this.validKeys.length > 1 ? 'active' : 'standby'})`,
      );
    } else if (single) {
      this.validKeys = [single];
    } else {
      this.validKeys = [];
      this.logger.error(
        '[Auth] No API keys configured (METABRAIN_API_KEYS or METABRAIN_API_KEY) — all requests will be rejected.',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.validKeys.length === 0) {
      throw new UnauthorizedException('Service not configured: no API keys');
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();

    const authHeader = request.headers['authorization'];
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('[Auth] Rejected: missing or malformed Authorization header');
      throw new UnauthorizedException('Authorization header must be: Bearer <token>');
    }

    const provided = authHeader.slice(7); // strip "Bearer "
    if (provided.length === 0) {
      throw new UnauthorizedException('Empty bearer token');
    }

    // Validate against all keys (no early-exit to avoid timing oracle on key position)
    const matchedKey = this.findMatchingKey(provided);
    if (matchedKey === null) {
      this.logger.warn('[Auth] Rejected: invalid bearer token');
      throw new UnauthorizedException('Invalid API key');
    }

    // Per-key rate limit
    const fingerprint = matchedKey.slice(0, ApiKeyGuard.FINGERPRINT_LEN);
    if (!this.checkRateLimit(fingerprint)) {
      this.logger.warn(`[Auth] Per-key rate limit exceeded for key ...${fingerprint}`);
      throw new HttpException('per_key_rate_limit_exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  /**
   * Iterates through ALL valid keys using constant-time comparison.
   * No early break — prevents timing side-channel leaking which position matched.
   */
  private findMatchingKey(provided: string): string | null {
    let matched: string | null = null;
    for (const key of this.validKeys) {
      if (this.constantTimeEquals(provided, key)) {
        matched = key; // deliberately no break
      }
    }
    return matched;
  }

  /** Sliding-window rate limit per key fingerprint. */
  private checkRateLimit(fingerprint: string): boolean {
    const now = Date.now();
    const windowStart = now - ApiKeyGuard.RATE_WINDOW_MS;

    if (!this.buckets.has(fingerprint)) {
      this.buckets.set(fingerprint, []);
    }
    const bucket = this.buckets.get(fingerprint)!;

    // Evict expired timestamps
    while (bucket.length > 0 && bucket[0] < windowStart) {
      bucket.shift();
    }

    if (bucket.length >= ApiKeyGuard.RATE_MAX) return false;

    bucket.push(now);
    return true;
  }

  /** Constant-time byte comparison — prevents timing oracle attacks. */
  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }
}
