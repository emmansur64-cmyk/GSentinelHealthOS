import { Injectable } from '@nestjs/common';
import { ExecutionResult, IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class BookingExecutor {
  async execute(input: IncidentPayload): Promise<ExecutionResult> {
    return {
      success: true,
      action: 'reconcile_booking_slots',
      details: `Reserva reconciliada para incidente ${input.id}`,
      rollbackSuggested: false,
    };
  }
}
