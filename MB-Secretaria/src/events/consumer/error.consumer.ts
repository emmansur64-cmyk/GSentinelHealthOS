import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ErrorConsumer {
  private readonly logger = new Logger(ErrorConsumer.name);

  consume(payload: Record<string, unknown>): void {
    this.logger.debug(`error event: ${JSON.stringify(payload)}`);
  }
}
