import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { MedicalCitation } from '../../knowledge/types';

/**
 * MedicalSearchGateway: INTERNET ACCESS BOUNDARY
 *
 * REPLACES: RuntimeToolsService direct fetch() calls
 * ENFORCES:
 * - Domain whitelisting only
 * - Timeout protection (3.5s max)
 * - Rate limiting per domain
 * - Prompt injection detection
 * - User-Agent spoofing prevention
 *
 * CONTEXT: RuntimeToolsService was making direct fetch() calls to:
 * - Google Search (uncontrolled query exposure)
 * - Open-Meteo (unvalidated location queries)
 * - Multiple medical sources (safe but uncontrolled)
 *
 * This gateway centralizes HTTP access to enforce security policies.
 */
@Injectable()
export class MedicalSearchGateway {
  private readonly logger = new Logger(MedicalSearchGateway.name);

  // Medical source domains WHITELIST
  private readonly allowedDomains = new Set([
    // Official Medical Guidelines
    'sati.org.ar',
    'argentina.gob.ar',
    'who.int',
    'paho.org',
    'cdc.gov',
    'nice.org.uk',
    'health.harvard.edu',
    'hopkinsmedicine.org',
    'med.stanford.edu',

    // Evidence & Research
    'pubmed.ncbi.nlm.nih.gov',
    'ncbi.nlm.nih.gov',
    'clinicaltrials.gov',

    // Weather (ONLY for location context, not arbitrary queries)
    'api.open-meteo.com',
    'geocoding-api.open-meteo.com',
    'maps.googleapis.com',
  ]);

  // Rate limit: requests per domain per minute
  private readonly rateLimitPerMinute = 10;
  private readonly requestLog = new Map<string, number[]>();

  // Dangerous patterns that suggest prompt injection or uncontrolled queries
  private readonly dangerousPatterns = [
    /ignore prompt|bypass|override|disable/gi,
    /sql injection|<script|javascript:/gi,
    /redirect|forward|exfiltrate/gi,
  ];

  /**
   * fetch() - Controlled HTTP access for Medical Chat
   *
   * @param url - Target URL (validated against whitelist)
   * @param query - Optional search query (validated for injection)
   * @throws BadRequestException if domain not allowed or injection detected
   * @throws ServiceUnavailableException if rate limit exceeded
   */
  async fetch(url: string, query?: string): Promise<Response> {
    this.validateDomain(url);
    this.validateQuery(query);
    this.checkRateLimit(url);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'user-agent': 'MB-Chat-MedicalSearchGateway/1.0 controlled-access',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
        },
      });

      clearTimeout(timeout);
      this.recordSuccessfulRequest(url);
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[MedicalSearchGateway] fetch failed: ${url} - ${msg}`);
      throw new ServiceUnavailableException(`Failed to fetch from ${this.extractDomain(url)}: ${msg}`);
    }
  }

  /**
   * fetchOfficialSourceEvidence() - Safe version for medical sources
   * Replaces RuntimeToolsService.fetchOfficialSourceEvidence()
   */
  async fetchOfficialSourceEvidence(sources: MedicalCitation[]): Promise<Array<{
    source: string;
    title: string;
    url: string;
    excerpt: string;
  }>> {
    const evidence = await Promise.all(
      sources.map((source) => this.fetchSingleSource(source))
    );
    return evidence.filter((item) => Boolean(item)) as any[];
  }

  private async fetchSingleSource(source: MedicalCitation): Promise<{
    source: string;
    title: string;
    url: string;
    excerpt: string;
  } | undefined> {
    try {
      this.validateDomain(source.url);
      const response = await this.fetch(source.url);

      if (!response.ok) return undefined;

      const text = await response.text();
      const excerpt = this.extractExcerpt(text);
      if (!excerpt) return undefined;

      return {
        source: source.source,
        title: source.title,
        url: source.url,
        excerpt,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`[MedicalSearchGateway] source fetch failed: ${source.url} - ${msg}`);
      return undefined;
    }
  }

  /**
   * Validate domain against whitelist
   */
  private validateDomain(url: string): void {
    try {
      const parsed = new URL(url);
      let domain = parsed.hostname?.toLowerCase();

      // Normalize domain by removing 'www.' prefix if present
      if (domain?.startsWith('www.')) {
        domain = domain.substring(4);
      }

      if (!domain || !this.allowedDomains.has(domain)) {
        throw new BadRequestException(
          `Domain '${domain}' is not whitelisted for Medical Chat access. ` +
          `Allowed domains: ${Array.from(this.allowedDomains).join(', ')}`
        );
      }

      if (parsed.protocol !== 'https:') {
        throw new BadRequestException(`Only HTTPS connections allowed. Got: ${parsed.protocol}`);
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Invalid URL: ${url}`);
    }
  }

  /**
   * Detect prompt injection or dangerous query patterns
   */
  private validateQuery(query?: string): void {
    if (!query) return;

    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(query)) {
        this.logger.warn(
          `[MedicalSearchGateway] Dangerous query pattern detected: ${query.slice(0, 50)}`
        );
        throw new BadRequestException(
          'Query contains suspicious patterns. Please rephrase your question.'
        );
      }
    }

    // Length check (prevent exfiltration attempts)
    if (query.length > 1000) {
      throw new BadRequestException('Query too long (max 1000 chars)');
    }
  }

  /**
   * Rate limiting per domain per minute
   */
  private checkRateLimit(url: string): void {
    const domain = this.extractDomain(url);
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const log = this.requestLog.get(domain) ?? [];
    const recentRequests = log.filter((timestamp) => timestamp > oneMinuteAgo);

    if (recentRequests.length >= this.rateLimitPerMinute) {
      throw new ServiceUnavailableException(
        `Rate limit exceeded for domain '${domain}'. Max ${this.rateLimitPerMinute} requests per minute.`
      );
    }

    this.requestLog.set(domain, [...recentRequests, now]);
  }

  private recordSuccessfulRequest(url: string): void {
    // Metrics could be recorded here
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname ?? 'unknown';
    } catch {
      return 'invalid-url';
    }
  }

  /**
   * Extract readable excerpt from HTML response
   */
  private extractExcerpt(html: string): string | undefined {
    // Remove HTML tags
    let text = html.replace(/<[^>]*>/g, ' ');

    // Clean whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Extract first meaningful paragraph
    const excerpt = text.slice(0, 300);
    return excerpt.length > 50 ? excerpt : undefined;
  }
}
