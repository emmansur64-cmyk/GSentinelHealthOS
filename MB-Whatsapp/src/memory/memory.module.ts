import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
