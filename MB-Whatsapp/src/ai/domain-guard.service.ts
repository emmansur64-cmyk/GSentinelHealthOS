import { ForbiddenException, Injectable } from '@nestjs/common';

// Mirrors domain/domain_guard.py — must stay in sync.
// MB-Whatsapp is scoped to appointment booking + basic medical assistance.
// Clinical diagnosis and deep clinical reasoning are out of scope for this channel.
const DISABLED_CAPABILITIES = new Set([
  'clinical_diagnosis',
  'clinical.reasoning',
  'deep_clinical_reasoning',
  'doctor_professional',
  'clinical_support',
  'secretary_ingestion',
  'spreadsheet_ingestion',
  'document_parsing',
  'full_clinical_history_access',
]);

@Injectable()
export class DomainGuardService {
  readonly domain = 'MB-Whatsapp';

  isCapabilityAllowed(capability: string): boolean {
    return !DISABLED_CAPABILITIES.has(capability.trim());
  }

  assertCapabilityAllowed(capability: string): void {
    if (!this.isCapabilityAllowed(capability)) {
      throw new ForbiddenException(`${this.domain} blocks capability: ${capability}`);
    }
  }
}
