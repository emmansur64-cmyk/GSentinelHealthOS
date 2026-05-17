import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { GroqSecretariaService } from '../providers/groq-secretaria.service';
import {
  RawImportRow,
  SupportedImportFormat,
  UploadedAdministrativeFile,
} from './import-preview.types';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.csv', '.xlsx']);
const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const HEADER_ALIASES: Record<string, string> = {
  doctor: 'doctorName',
  doctorname: 'doctorName',
  medico: 'doctorName',
  'médico': 'doctorName',
  profesional: 'doctorName',
  specialty: 'specialty',
  especialidad: 'specialty',
  location: 'location',
  sede: 'location',
  consultorio: 'location',
  day: 'dayOfWeek',
  dia: 'dayOfWeek',
  'día': 'dayOfWeek',
  dayofweek: 'dayOfWeek',
  start: 'startTime',
  inicio: 'startTime',
  horainicio: 'startTime',
  starttime: 'startTime',
  end: 'endTime',
  fin: 'endTime',
  horafin: 'endTime',
  endtime: 'endTime',
};

@Injectable()
export class ScheduleImportParserService {
  constructor(@Optional() private readonly groqSecretaria?: GroqSecretariaService) {}

  async parse(file: UploadedAdministrativeFile): Promise<RawImportRow[]> {
    const format = this.validateFile(file);
    return format === 'csv' ? this.parseCsv(file.buffer) : this.parseXlsx(file.buffer);
  }

  private validateFile(file: UploadedAdministrativeFile): SupportedImportFormat {
    if (file.size <= 0) {
      throw new BadRequestException('Archivo vacio.');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('Archivo excede el tamano maximo permitido.');
    }

    const extension = this.getExtension(file.originalName);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Extension de archivo no permitida.');
    }
    if (file.mimeType && !ALLOWED_MIME_TYPES.has(file.mimeType)) {
      throw new BadRequestException('Mimetype de archivo no permitido.');
    }

    return extension === '.csv' ? 'csv' : 'xlsx';
  }

  private getExtension(name: string): string {
    const index = name.lastIndexOf('.');
    return index >= 0 ? name.slice(index).toLowerCase() : '';
  }

  private async parseCsv(buffer: Buffer): Promise<RawImportRow[]> {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const records = this.parseCsvRecords(text);
    return this.recordsToRows(records);
  }

  private parseCsvRecords(text: string): string[][] {
    const records: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      const next = text[index + 1];

      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') index++;
        row.push(cell);
        records.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    row.push(cell);
    if (row.some((value) => value.trim().length > 0)) records.push(row);
    return records;
  }

  private async parseXlsx(buffer: Buffer): Promise<RawImportRow[]> {
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as never);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet) {
      throw new BadRequestException('XLSX sin hojas.');
    }

    const records: string[][] = [];
    firstSheet.eachRow({ includeEmpty: true }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      records.push(values.map((value) => String(value ?? '')));
    });
    return this.recordsToRows(records);
  }

  private async recordsToRows(records: string[][]): Promise<RawImportRow[]> {
    const [headerRow, ...bodyRows] = records;
    if (!headerRow) {
      throw new BadRequestException('Archivo sin encabezados.');
    }

    const headers = headerRow.map((header) => this.normalizeHeader(String(header)));
    const unknownHeaderIndexes = headers
      .map((header, index) => ({ header, index }))
      .filter(({ header }) => header.length > 0 && HEADER_ALIASES[header] === undefined);
    const groqAliases = await this.resolveGroqHeaderAliases(headerRow, unknownHeaderIndexes.map(({ index }) => index));

    return bodyRows.map((record, index) => {
      const values: Record<string, string> = {};
      for (const [columnIndex, header] of headers.entries()) {
        const rawHeader = String(headerRow[columnIndex] ?? '').trim();
        const canonical = HEADER_ALIASES[header] ?? groqAliases[rawHeader];
        if (canonical) {
          values[canonical] = String(record[columnIndex] ?? '').trim();
        }
      }

      return {
        rowNumber: index + 2,
        values,
        unknownColumns: unknownHeaderIndexes.map(({ index: columnIndex }) => String(headerRow[columnIndex])),
        empty: record.every((cell) => String(cell ?? '').trim().length === 0),
      };
    });
  }

  private normalizeHeader(value: string): string {
    return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  private async resolveGroqHeaderAliases(
    headerRow: string[],
    unknownHeaderIndexes: number[],
  ): Promise<Record<string, string>> {
    if (!this.groqSecretaria?.isConfigured() || unknownHeaderIndexes.length === 0) return {};

    const unknownHeaders = unknownHeaderIndexes.map((index) => String(headerRow[index] ?? '').trim()).filter(Boolean);
    return this.groqSecretaria.resolveHeaderAliases(unknownHeaders);
  }
}
