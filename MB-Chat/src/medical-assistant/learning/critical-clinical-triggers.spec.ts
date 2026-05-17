import { detect_critical_clinical_triggers } from './critical-clinical-triggers';

describe('detect_critical_clinical_triggers', () => {
  it('detecta trigger cardiovascular por dolor toracico con esfuerzo', () => {
    const out = detect_critical_clinical_triggers('Paciente con dolor toracico con esfuerzo desde hace 2 dias');
    expect(out.some((t) => t.category === 'cardiovascular' && t.trigger_key === 'dolor_toracico_esfuerzo')).toBe(true);
  });

  it('detecta trigger neurologico por cefalea subita intensa', () => {
    const out = detect_critical_clinical_triggers('Presenta cefalea súbita intensa con inicio abrupto');
    expect(out.some((t) => t.category === 'neurologico' && t.trigger_key === 'cefalea_subita_intensa')).toBe(true);
  });

  it('detecta trigger respiratorio por disnea severa o cianosis', () => {
    const out = detect_critical_clinical_triggers('Disnea severa con cianosis en reposo');
    expect(out.some((t) => t.category === 'respiratorio' && (t.trigger_key === 'disnea_severa' || t.trigger_key === 'cianosis'))).toBe(true);
  });

  it('detecta trigger obstetrico por sangrado en embarazo', () => {
    const out = detect_critical_clinical_triggers('Sangrado en embarazo de 12 semanas');
    expect(out.some((t) => t.category === 'obstetrico_ginecologico' && t.trigger_key === 'sangrado_embarazo')).toBe(true);
  });

  it('texto benigno no genera trigger critico', () => {
    const out = detect_critical_clinical_triggers('Consulta administrativa sobre turnos y horarios');
    expect(out).toHaveLength(0);
  });

  it('memory_safe_summary no expone PHI cruda obvia', () => {
    const out = detect_critical_clinical_triggers('dolor toracico con esfuerzo. paciente: Juan Perez DNI 12345678');
    expect(out.length).toBeGreaterThan(0);
    const dump = JSON.stringify(out);
    expect(dump).not.toContain('12345678');
    expect(dump).not.toContain('Juan Perez');
  });
});
