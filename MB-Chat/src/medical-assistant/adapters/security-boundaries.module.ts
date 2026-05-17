import { Module } from '@nestjs/common';
import { MedicalChatBrainAdapter } from './medical-chat-brain.adapter';
import { MedicalSearchGateway } from './medical-search.gateway';
import { MedicalChatEventBoundary } from './medical-chat-event.boundary';

/**
 * MedicalChatSecurityBoundariesModule
 *
 * Provides isolation boundary adapters:
 * - MedicalChatBrainAdapter: Blocks lateral movement to BrainService
 * - MedicalSearchGateway: Controls HTTP/internet access with domain whitelist
 * - MedicalChatEventBoundary: Blocks autonomous RabbitMQ event publishing
 */
@Module({
  providers: [
    MedicalChatBrainAdapter,
    MedicalSearchGateway,
    MedicalChatEventBoundary,
  ],
  exports: [
    MedicalChatBrainAdapter,
    MedicalSearchGateway,
    MedicalChatEventBoundary,
  ],
})
export class MedicalChatSecurityBoundariesModule {}
