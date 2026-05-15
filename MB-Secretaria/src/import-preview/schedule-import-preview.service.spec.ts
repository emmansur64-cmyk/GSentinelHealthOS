import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ScheduleImportParserService } from './schedule-import-parser.service';
import { ScheduleImportPreviewService } from './schedule-import-preview.service';
import { UploadedAdministrativeFile } from './import-preview.types';

function csvFile(content: string, originalName = 'horarios.csv', mimeType = 'text/csv'): UploadedAdministrativeFile {
  const buffer = Buffer.from(content, 'utf8');
  return {
    originalName,
    mimeType,
    size: buffer.length,
    buffer,
  };
}

async function xlsxFile(rows: string[][]): Promise<UploadedAdministrativeFile> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Horarios');
  sheet.addRows(rows);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    originalName: 'horarios.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: buffer.length,
    buffer,
  };
}

describe('ScheduleImportPreviewService', () => {
  const service = new ScheduleImportPreviewService(new ScheduleImportParserService());
  const tenantId = 'tenant-admin-1';
  const header = 'doctorName,specialty,location,dayOfWeek,startTime,endTime';

  it('CSV valido genera preview administrativo', async () => {
    const result = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);

    expect(result.status).toBe('preview_only');
    expect(result.applyEnabled).toBe(false);
    expect(result.summary).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0 });
    expect(result.rows[0].normalized).toMatchObject({
      doctorName: 'Dra Perez',
      specialty: 'Cardiologia',
      location: 'Sede Norte',
      dayOfWeek: 'monday',
      startTime: '09:00',
      endTime: '12:00',
      tenantId,
    });
    expect(result.agendaApiPayloadPreview).toHaveLength(1);
    expect(result.agendaApiPayloadPreview[0].rowIdempotencyKey).toBe(result.rows[0].rowIdempotencyKey);
  });

  it('XLSX valido genera preview administrativo', async () => {
    const result = await service.preview(
      await xlsxFile([
        ['medico', 'especialidad', 'sede', 'dia', 'inicio', 'fin'],
        ['Dr Gomez', 'Traumatologia', 'Centro', 'martes', '10:00', '11:30'],
      ]),
      tenantId,
    );

    expect(result.summary.validRows).toBe(1);
    expect(result.rows[0].normalized.dayOfWeek).toBe('tuesday');
    expect(result.applyEnabled).toBe(false);
  });

  it('archivo invalido es rechazado', async () => {
    await expect(service.preview(csvFile('x', 'horarios.pdf', 'application/pdf'), tenantId)).rejects.toThrow(BadRequestException);
  });

  it('fila sin medico falla', async () => {
    const result = await service.preview(csvFile(`${header}\n,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);

    expect(result.rows[0].status).toBe('invalid');
    expect(result.rows[0].errors).toContain('doctor_required');
  });

  it('hora inicio mayor que hora fin falla', async () => {
    const result = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,13:00,12:00`), tenantId);

    expect(result.rows[0].errors).toContain('start_time_must_be_before_end_time');
  });

  it('duplicado exacto dentro del archivo es detectado', async () => {
    const row = 'Dra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00';
    const result = await service.preview(csvFile(`${header}\n${row}\n${row}`), tenantId);

    expect(result.summary.duplicates).toBe(2);
    expect(result.rows.every((previewRow) => previewRow.errors.includes('duplicate_exact_row'))).toBe(true);
  });

  it('solape por medico dia y sede es detectado', async () => {
    const result = await service.preview(
      csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00\nDra Perez,Cardiologia,Sede Norte,lunes,11:00,13:00`),
      tenantId,
    );

    expect(result.summary.overlaps).toBe(2);
    expect(result.rows.every((previewRow) => previewRow.errors.includes('overlap_same_doctor_day_location'))).toBe(true);
  });

  it('no acepta contenido clinico ni imaging en archivo administrativo', async () => {
    const result = await service.preview(csvFile(`${header}\nDra Perez,diagnosis,Sede Norte,lunes,09:00,12:00`), tenantId);

    expect(result.rows[0].errors).toContain('forbidden_domain_content');
  });

  it('no llama Agenda API ni escribe DB: solo devuelve payload preview', async () => {
    const result = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);

    expect(result.applyEnabled).toBe(false);
    expect(result.agendaApiPayloadPreview[0]).toMatchObject({ tenantId, doctorName: 'Dra Perez' });
  });

  it('requiere tenantId tambien a nivel servicio', async () => {
    await expect(service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00`), ' ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('incluye agendaDryRun bloqueado y sin envio', async () => {
    const result = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);

    expect(result.applyEnabled).toBe(false);
    expect(result.agendaDryRun).toMatchObject({
      enabled: true,
      mode: 'local_contract_validation',
      wouldSend: false,
      applyBlocked: true,
      validPayloadRows: 1,
      rejectedPayloadRows: 0,
    });
  });

  it('batchIdempotencyKey es deterministica para el mismo contenido administrativo', async () => {
    const first = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);
    const second = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);

    expect(first.batchId).not.toBe(second.batchId);
    expect(first.agendaDryRun.batchIdempotencyKey).toBe(second.agendaDryRun.batchIdempotencyKey);
  });

  it('rowIdempotencyKey es deterministica para la misma fila valida', async () => {
    const first = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);
    const second = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);

    expect(first.agendaApiPayloadPreview[0].rowIdempotencyKey).toBe(second.agendaApiPayloadPreview[0].rowIdempotencyKey);
  });

  it('rowIdempotencyKey cambia si cambia el horario', async () => {
    const first = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);
    const second = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,10:00,12:00`), tenantId);

    expect(first.agendaApiPayloadPreview[0].rowIdempotencyKey).not.toBe(second.agendaApiPayloadPreview[0].rowIdempotencyKey);
  });

  it('rowIdempotencyKey cambia si cambia el medico', async () => {
    const first = await service.preview(csvFile(`${header}\nDra Perez,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);
    const second = await service.preview(csvFile(`${header}\nDr Gomez,Cardiologia,Sede Norte,lunes,09:00,12:00`), tenantId);

    expect(first.agendaApiPayloadPreview[0].rowIdempotencyKey).not.toBe(second.agendaApiPayloadPreview[0].rowIdempotencyKey);
  });
});
