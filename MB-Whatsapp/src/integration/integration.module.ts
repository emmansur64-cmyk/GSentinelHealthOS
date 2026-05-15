import { Module } from '@nestjs/common';
import { MetaBrainClient } from './metabrain.client';
import { MetaBrainHandler } from './metabrain.handler';

@Module({
  providers: [MetaBrainClient, MetaBrainHandler],
  exports: [MetaBrainClient, MetaBrainHandler],
})
export class IntegrationModule {}