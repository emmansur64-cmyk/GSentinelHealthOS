import { Injectable } from '@nestjs/common';
import { ErrorFingerprint } from '../common/types/brain.types';

@Injectable()
export class BrainRouter {
  route(fingerprint: ErrorFingerprint): 'booking' | 'schedule' | 'error' {
    if (fingerprint.category === 'booking') {
      return 'booking';
    }

    if (fingerprint.category === 'schedule') {
      return 'schedule';
    }

    return 'error';
  }
}
