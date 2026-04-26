import { Injectable, Logger } from '@nestjs/common';
import { IncidentPayload } from '../../common/types/brain.types';

interface PatternGroup {
  category: string;
  patterns: readonly RegExp[];
}

@Injectable()
export class SafetyRules {
  private readonly logger = new Logger(SafetyRules.name);

  private static readonly PATTERN_GROUPS: readonly PatternGroup[] = [
    {
      category: 'sql_injection',
      patterns: [
        /drop\s+table/i,
        /delete\s+from/i,
        /truncate\s+(table\s+)?/i,
        /alter\s+table/i,
        /insert\s+into/i,
        /union\s+select/i,
        /--\s*$/m,
        /;\s*select\b/i,
      ],
    },
    {
      category: 'shell_injection',
      patterns: [
        /rm\s+-rf/i,
        /del\s+\/[fqs]/i,
        /format\s+[a-z]:/i,
        /shutdown\s*(\/[srh]|-[srh])/i,
        /rmdir\s+\/s/i,
        /mkfs\b/i,
        /\bdd\s+if=/i,
      ],
    },
    {
      category: 'command_chaining',
      patterns: [
        /&&/,
        /\|\|/,
        /;\s*\w/,
        /`[^`]+`/,
        /\$\([^)]+\)/,
      ],
    },
    {
      category: 'powershell_execution',
      patterns: [
        /invoke-expression/i,
        /\biex\b/i,
        /invoke-webrequest/i,
        /invoke-restmethod/i,
        /start-process/i,
        /\[system\.reflection/i,
        /\bdownloadstring\b/i,
        /add-type\b/i,
        /-encodedcommand\b/i,
      ],
    },
    {
      category: 'network_exfiltration',
      patterns: [
        /\bcurl\s+https?:\/\//i,
        /\bwget\s+https?:\/\//i,
        /\bnc\b.*-[el]/i,
        /\bnmap\b/i,
        /\btelnet\b/i,
      ],
    },
    {
      category: 'encoding_obfuscation',
      patterns: [
        /\bbase64\b.*decode/i,
        /frombase64string/i,
        /charcodeat/i,
        /\\x[0-9a-f]{2}/i,
        /\\u[0-9a-f]{4}/i,
      ],
    },
  ];

  evaluate(input: IncidentPayload): string[] {
    const candidates = this.gatherTextCandidates(input);

    for (const { category, patterns } of SafetyRules.PATTERN_GROUPS) {
      for (const pattern of patterns) {
        for (const candidate of candidates) {
          if (pattern.test(candidate)) {
            this.logger.warn(
              `[SafetyRules] Blocked: category=${category} source=${input.source} id=${input.id}`,
            );
            return [`unsafe_payload_detected:${category}`];
          }
        }
      }
    }

    return [];
  }

  private normalize(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ');
  }

  private gatherTextCandidates(input: IncidentPayload): string[] {
    const candidates: string[] = [
      this.normalize(`${input.message} ${input.stack ?? ''}`),
    ];

    const logs = input.metadata?.logs;
    if (Array.isArray(logs)) {
      candidates.push(
        this.normalize(logs.filter((l) => typeof l === 'string').join(' ')),
      );
    }

    const data = input.metadata?.data;
    if (data !== null && typeof data === 'object') {
      try {
        candidates.push(this.normalize(JSON.stringify(data)));
      } catch {
        // non-serializable — skip safely
      }
    }

    const metrics = input.metadata?.metrics;
    if (metrics !== null && typeof metrics === 'object') {
      try {
        candidates.push(this.normalize(JSON.stringify(metrics)));
      } catch {
        // non-serializable — skip safely
      }
    }

    return candidates;
  }
}


