import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
