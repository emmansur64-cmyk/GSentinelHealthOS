import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SystemConsumer {
  private readonly logger = new Logger(SystemConsumer.name);

  consume(payload: Record<string, unknown>): void {
    this.logger.debug(`system event: ${JSON.stringify(payload)}`);
  }
}
