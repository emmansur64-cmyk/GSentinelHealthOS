import { DiagnosisService } from './diagnosis.service';
import { XaiExplainabilityMode } from './diagnosis.types';

describe('DiagnosisService', () => {
  it('construye reporte XAI SRE-Med en modo auditoria', () => {
    const service = new DiagnosisService({ analyze: jest.fn() } as never);

    const report = service.buildXaiAuditConsole({
      query: 'Paciente con paralisis tirootoxica e hipopotasemia',
      answer: 'Evitar reposicion agresiva de potasio y priorizar control tirotoxicosis',
      mode: XaiExplainabilityMode.MODO_AUDITORIA,
      citations: [
        {
          source: 'guideline',
          title: 'ATA Guidelines for Hyperthyroidism',
          url: 'https://example.org/ata',
          date: '2024-01-01',
        },
      ],
    });

    expect(report.matrix.standard).toBe('SRE-Med');
    expect(report.explainabilityMode).toBe(XaiExplainabilityMode.MODO_AUDITORIA);
    expect(report.matrix.layers.bibliographicEvidence.clinicalGuidelines.length).toBeGreaterThan(0);
  });

  it('acopla diccionarios de citas al metodo generar_diagnostico_auditable sin errores de tipado', () => {
    const service = new DiagnosisService({ analyze: jest.fn() } as never);

    const report = service.generar_diagnostico_auditable({
      query: 'caso clinico de hipopotasemia severa',
      answer: 'ajustar reposicion de potasio segun fisiopatologia tirotoxica',
      mode: XaiExplainabilityMode.MODO_MEDICO,
      citationDictionaries: [
        {
          fuente: 'guideline',
          link: 'https://example.org/ata-guideline',
          titulo: 'ATA Hyperthyroidism Guideline',
          fecha: '2024-01-01',
        },
        {
          source: 'pubmed',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
          title: 'Hypokalemic periodic paralysis evidence review',
          date: '2023-05-10',
        },
      ],
    });

    expect(report.explainabilityMode).toBe(XaiExplainabilityMode.MODO_MEDICO);
    expect(report.matrix.layers.bibliographicEvidence.clinicalGuidelines.length).toBeGreaterThan(0);
    expect(report.matrix.layers.bibliographicEvidence.indexedLiterature.length).toBeGreaterThan(0);
  });
});
