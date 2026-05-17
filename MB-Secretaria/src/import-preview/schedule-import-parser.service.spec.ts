import { GroqSecretariaService } from '../providers/groq-secretaria.service';
import { ScheduleImportParserService } from './schedule-import-parser.service';

describe('ScheduleImportParserService', () => {
  it('usa Groq Secretaria para aliases administrativos no conocidos localmente', async () => {
    const groqSecretaria = {
      isConfigured: () => true,
      resolveHeaderAliases: jest.fn().mockResolvedValue({
        Prestador: 'doctorName',
        'Prestacion administrativa': 'specialty',
        Sucursal: 'location',
        Fecha: 'dayOfWeek',
        Desde: 'startTime',
        Hasta: 'endTime',
      }),
    } as unknown as GroqSecretariaService;
    const parser = new ScheduleImportParserService(groqSecretaria);
    const csv = [
      'Prestador,Prestacion administrativa,Sucursal,Fecha,Desde,Hasta',
      'Dra Perez,Cardiologia,Sede Centro,lunes,09:00,10:00',
    ].join('\n');

    await expect(
      parser.parse({
        originalName: 'agenda.csv',
        mimeType: 'text/csv',
        size: Buffer.byteLength(csv),
        buffer: Buffer.from(csv, 'utf8'),
      }),
    ).resolves.toEqual([
      {
        rowNumber: 2,
        values: {
          doctorName: 'Dra Perez',
          specialty: 'Cardiologia',
          location: 'Sede Centro',
          dayOfWeek: 'lunes',
          startTime: '09:00',
          endTime: '10:00',
        },
        unknownColumns: [
          'Prestador',
          'Prestacion administrativa',
          'Sucursal',
          'Fecha',
          'Desde',
          'Hasta',
        ],
        empty: false,
      },
    ]);
    expect(groqSecretaria.resolveHeaderAliases).toHaveBeenCalledWith([
      'Prestador',
      'Prestacion administrativa',
      'Sucursal',
      'Fecha',
      'Desde',
      'Hasta',
    ]);
  });
});
