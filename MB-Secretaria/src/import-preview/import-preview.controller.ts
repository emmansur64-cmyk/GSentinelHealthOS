import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminAccessError, AdminAccessGuard } from './admin-access.guard';
import { ImportPreviewAuditService } from './import-preview-audit.service';
import { ImportPreviewResponse } from './import-preview.types';
import { ScheduleImportPreviewService } from './schedule-import-preview.service';

interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('admin/import')
export class ImportPreviewController {
  constructor(
    private readonly previewService: ScheduleImportPreviewService,
    private readonly adminAccessGuard: AdminAccessGuard = new AdminAccessGuard(),
    private readonly auditService: ImportPreviewAuditService = new ImportPreviewAuditService(),
  ) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async preview(
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-admin-api-key') adminApiKey: string | undefined,
    @Headers('x-user-role') userRole: string | undefined,
    @Headers('x-user-id') userId: string | undefined,
    @Headers('x-user-scope') userScope: string | undefined,
  ): Promise<ImportPreviewResponse> {
    let accessContext;
    try {
      accessContext = this.adminAccessGuard.authorize({
        tenantId,
        adminApiKey,
        userRole,
        userId,
        userScope,
      });
    } catch (error) {
      if (error instanceof AdminAccessError) {
        await this.auditService.recordRejected({
          reason: error.reason,
          tenantId,
          userId,
          userRole,
          scope: userScope,
        });
        throw error.httpError;
      }
      throw error;
    }

    if (!file) {
      throw new BadRequestException('Archivo requerido.');
    }

    const preview = await this.previewService.preview(
      {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      accessContext.tenantId,
    );
    await this.auditService.recordSuccess(accessContext, preview);
    return preview;
  }
}
