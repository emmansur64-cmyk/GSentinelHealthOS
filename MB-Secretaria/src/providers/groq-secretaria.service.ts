import { Injectable, Logger } from '@nestjs/common';
import { getGroqSecretariaConfig, GroqSecretariaConfig } from './groq-secretaria.config';

type GroqChatMessage = {
  role: 'system' | 'user';
  content: string;
};

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

export type SecretariaHeaderField =
  | 'doctorName'
  | 'specialty'
  | 'location'
  | 'dayOfWeek'
  | 'startTime'
  | 'endTime';

type HeaderMappingResponse = Record<string, SecretariaHeaderField | null>;

const ALLOWED_FIELDS = new Set<SecretariaHeaderField>([
  'doctorName',
  'specialty',
  'location',
  'dayOfWeek',
  'startTime',
  'endTime',
]);

@Injectable()
export class GroqSecretariaService {
  private readonly logger = new Logger(GroqSecretariaService.name);

  constructor(private readonly config: GroqSecretariaConfig = getGroqSecretariaConfig()) {}

  isConfigured(): boolean {
    return this.config.enabled;
  }

  async resolveHeaderAliases(headers: string[]): Promise<Record<string, SecretariaHeaderField>> {
    const uniqueHeaders = [...new Set(headers.map((header) => header.trim()).filter(Boolean))];
    if (!this.config.enabled || uniqueHeaders.length === 0) return {};

    try {
      const content = await this.chat([
        {
          role: 'system',
          content: [
            'Sos MB-Secretaria, modulo administrativo de agenda medica.',
            'Tu unica tarea es mapear encabezados de una planilla administrativa.',
            'No diagnostiques, no hagas triage, no interpretes datos clinicos.',
            'Responde solo JSON valido: {"encabezado":"doctorName|specialty|location|dayOfWeek|startTime|endTime|null"}.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            allowedFields: [...ALLOWED_FIELDS],
            headers: uniqueHeaders,
          }),
        },
      ]);
      return this.parseHeaderMapping(content, uniqueHeaders);
    } catch (error) {
      this.logger.warn(`secretaria.groq.header_mapping_failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return {};
    }
  }

  private async chat(messages: GroqChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: 0,
          max_tokens: 220,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`GROQ_SECRETARIA_HTTP_${response.status}`);
      }

      const data = (await response.json()) as GroqChatResponse;
      const content = data.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : '';
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseHeaderMapping(content: string, requestedHeaders: string[]): Record<string, SecretariaHeaderField> {
    if (!content.trim()) return {};

    const parsed = JSON.parse(content) as HeaderMappingResponse;
    const requested = new Set(requestedHeaders);
    const mapping: Record<string, SecretariaHeaderField> = {};

    for (const [header, field] of Object.entries(parsed)) {
      if (!requested.has(header)) continue;
      if (!field || !ALLOWED_FIELDS.has(field)) continue;
      mapping[header] = field;
    }

    return mapping;
  }
}
