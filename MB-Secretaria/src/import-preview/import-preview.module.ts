import { Module } from '@nestjs/common';
import { GroqSecretariaService } from '../providers/groq-secretaria.service';
import { AdminAccessGuard } from './admin-access.guard';
import { AgendaApiDryRunClient } from './agenda-api-dry-run.client';
import { AgendaApiHttpDryRunClient } from './agenda-api-http-dry-run.client';
import { ImportPreviewAuditService } from './import-preview-audit.service';
import { ImportPreviewController } from './import-preview.controller';
import { ScheduleImportParserService } from './schedule-import-parser.service';
import { ScheduleImportPreviewService } from './schedule-import-preview.service';

@Module({
  controllers: [ImportPreviewController],
  providers: [
    AdminAccessGuard,
    AgendaApiDryRunClient,
    AgendaApiHttpDryRunClient,
    GroqSecretariaService,
    ImportPreviewAuditService,
    ScheduleImportParserService,
    ScheduleImportPreviewService,
  ],
  exports: [ScheduleImportPreviewService],
})
export class ImportPreviewModule {}
