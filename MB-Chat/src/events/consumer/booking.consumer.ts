import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BookingConsumer {
  private readonly logger = new Logger(BookingConsumer.name);

  consume(payload: Record<string, unknown>): void {
    this.logger.debug(`booking event: ${JSON.stringify(payload)}`);
  }
}
