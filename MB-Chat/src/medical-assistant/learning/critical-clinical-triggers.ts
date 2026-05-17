export type ClinicalTriggerSeverityHint = 'low' | 'medium' | 'high';

export interface ClinicalTrigger {
  category:
    | 'cardiovascular'
    | 'neurologico'
    | 'respiratorio'
    | 'infeccioso_sepsis'
    | 'digestivo_abdominal'
    | 'obstetrico_ginecologico'
    | 'pediatrico';
  trigger_key: string;
  matched_terms: string[];
  clinical_relevance: string;
  recommended_followup_questions: string[];
  red_flags_to_rule_out: string[];
  severity_hint: ClinicalTriggerSeverityHint;
  memory_safe_summary: string;
  phi_safe: true;
}

type TriggerRule = Omit<ClinicalTrigger, 'matched_terms' | 'memory_safe_summary' | 'phi_safe'> & {
  terms: RegExp[];
};

const RULES: TriggerRule[] = [
  {
    category: 'cardiovascular',
    trigger_key: 'dolor_toracico_esfuerzo',
    terms: [/\bdolor\s+toracic[oa].*esfuerzo\b/i, /\bangina\s+de\s+esfuerzo\b/i],
    clinical_relevance: 'Patron compatible con evento cardiovascular que requiere evaluacion dirigida.',
    recommended_followup_questions: ['Cuando inicia y cuanto dura el dolor?', 'Se asocia a sudoracion, nauseas o disnea?'],
    red_flags_to_rule_out: ['dolor toracico persistente', 'inestabilidad hemodinamica'],
    severity_hint: 'high',
  },
  {
    category: 'cardiovascular',
    trigger_key: 'dolor_toracico_reposo',
    terms: [/\bdolor\s+toracic[oa].*reposo\b/i],
    clinical_relevance: 'Dolor toracico en reposo sugiere necesidad de evaluacion urgente.',
    recommended_followup_questions: ['El dolor irradia a brazo/mandibula?', 'Hay empeoramiento progresivo?'],
    red_flags_to_rule_out: ['sindrome coronario agudo', 'arritmia inestable'],
    severity_hint: 'high',
  },
  {
    category: 'cardiovascular',
    trigger_key: 'sincope',
    terms: [/\bsincop[eé]\b/i, /\bperdida\s+de\s+conocimiento\b/i],
    clinical_relevance: 'Sincope requiere estratificacion de riesgo cardiovascular y neurologico.',
    recommended_followup_questions: ['Hubo prodromos?', 'Recuperacion completa o confusion posterior?'],
    red_flags_to_rule_out: ['causa cardiaca de alto riesgo', 'trauma secundario'],
    severity_hint: 'high',
  },
  {
    category: 'cardiovascular',
    trigger_key: 'disnea_progresiva',
    terms: [/\bdisnea\s+progresiva\b/i, /\bfalta\s+de\s+aire\s+progresiva\b/i],
    clinical_relevance: 'Disnea progresiva exige evaluar compromiso cardiorrespiratorio.',
    recommended_followup_questions: ['Desde cuando progresa?', 'Se agrava en decubito o de noche?'],
    red_flags_to_rule_out: ['edema agudo pulmonar', 'tromboembolismo pulmonar'],
    severity_hint: 'medium',
  },
  {
    category: 'cardiovascular',
    trigger_key: 'palpitaciones_presincope',
    terms: [/\bpalpitaciones\b.*\bpresincop[eé]\b/i, /\bpalpitaciones\b.*\bmareo\s+intenso\b/i],
    clinical_relevance: 'Posible arritmia sintomatica con riesgo de inestabilidad.',
    recommended_followup_questions: ['Duracion de episodios?', 'Hay dolor toracico o disnea asociada?'],
    red_flags_to_rule_out: ['taquiarritmia inestable', 'sincope arrtimico'],
    severity_hint: 'high',
  },
  {
    category: 'neurologico',
    trigger_key: 'cefalea_subita_intensa',
    terms: [/\bcefalea\s+s[uú]bita\s+intensa\b/i, /\bpeor\s+cefalea\b/i],
    clinical_relevance: 'Cefalea subita intensa requiere descarte de causa secundaria grave.',
    recommended_followup_questions: ['Inicio en segundos/minutos?', 'Se asocia a deficit neurologico o vomitos?'],
    red_flags_to_rule_out: ['hemorragia subaracnoidea', 'hipertension endocraneana'],
    severity_hint: 'high',
  },
  {
    category: 'neurologico',
    trigger_key: 'deficit_focal',
    terms: [/\bd[eé]ficit\s+focal\b/i, /\bhemiparesia\b/i, /\bafasia\b/i],
    clinical_relevance: 'Signos focales ameritan evaluacion neurologica urgente.',
    recommended_followup_questions: ['Hora de inicio exacta?', 'Sintomas en progresion o fluctuantes?'],
    red_flags_to_rule_out: ['evento cerebrovascular', 'lesion ocupante de espacio'],
    severity_hint: 'high',
  },
  {
    category: 'neurologico',
    trigger_key: 'alteracion_conciencia',
    terms: [/\balteraci[oó]n\s+del\s+estado\s+de\s+conciencia\b/i, /\bsomnolencia\s+marcada\b/i, /\bconfusi[oó]n\b/i],
    clinical_relevance: 'Alteracion de conciencia sugiere compromiso sistemico o neurologico.',
    recommended_followup_questions: ['Evolucion temporal?', 'Hubo fiebre, trauma o convulsiones?'],
    red_flags_to_rule_out: ['encefalopatia aguda', 'sepsis o toxicidad'],
    severity_hint: 'high',
  },
  {
    category: 'neurologico',
    trigger_key: 'convulsiones',
    terms: [/\bconvulsi[oó]n(?:es)?\b/i, /\bcrisis\s+tonico\b/i],
    clinical_relevance: 'Convulsiones requieren estratificacion urgente y seguimiento etiologico.',
    recommended_followup_questions: ['Duracion de la crisis?', 'Periodo postictal presente?'],
    red_flags_to_rule_out: ['estatus epileptico', 'causa metabolica grave'],
    severity_hint: 'high',
  },
  {
    category: 'neurologico',
    trigger_key: 'rigidez_nuca_fiebre',
    terms: [/\brigidez\s+de\s+nuca\b.*\bfiebre\b/i, /\bfiebre\b.*\brigidez\s+de\s+nuca\b/i],
    clinical_relevance: 'Sintomas compatibles con sindrome meningeo requieren urgencia.',
    recommended_followup_questions: ['Hay fotofobia o vomitos?', 'Estado mental basal conservado?'],
    red_flags_to_rule_out: ['meningitis', 'encefalitis'],
    severity_hint: 'high',
  },
  {
    category: 'respiratorio',
    trigger_key: 'disnea_severa',
    terms: [/\bdisnea\s+severa\b/i, /\bfalta\s+de\s+aire\s+severa\b/i],
    clinical_relevance: 'Disnea severa implica riesgo de falla respiratoria.',
    recommended_followup_questions: ['Habla en frases completas?', 'Uso de musculos accesorios?'],
    red_flags_to_rule_out: ['insuficiencia respiratoria aguda', 'TEP'],
    severity_hint: 'high',
  },
  {
    category: 'respiratorio',
    trigger_key: 'cianosis',
    terms: [/\bcianosis\b/i, /\blabios\s+morados\b/i],
    clinical_relevance: 'Signo de hipoxemia que requiere atencion inmediata.',
    recommended_followup_questions: ['Inicio brusco o progresivo?', 'Saturacion disponible?'],
    red_flags_to_rule_out: ['hipoxemia grave', 'compromiso ventilatorio'],
    severity_hint: 'high',
  },
  {
    category: 'respiratorio',
    trigger_key: 'hemoptisis',
    terms: [/\bhemoptisis\b/i, /\btos(?:er)?\s+sangre\b/i],
    clinical_relevance: 'Hemoptisis requiere evaluacion urgente de causa subyacente.',
    recommended_followup_questions: ['Cantidad estimada?', 'Se acompana de disnea o dolor pleuritico?'],
    red_flags_to_rule_out: ['TEP', 'hemorragia alveolar'],
    severity_hint: 'high',
  },
  {
    category: 'respiratorio',
    trigger_key: 'saturacion_baja',
    terms: [/\b(?:sat(?:uraci[oó]n)?\s*(?:de)?\s*o2|spo2)\s*(?:de|:)?\s*(\d{2})\b/i],
    clinical_relevance: 'Saturacion baja reportada; requiere correlacion clinica inmediata.',
    recommended_followup_questions: ['Valor repetido y tendencia?', 'Oxigenoterapia en curso?'],
    red_flags_to_rule_out: ['hipoxemia sostenida', 'fatiga respiratoria'],
    severity_hint: 'high',
  },
  {
    category: 'respiratorio',
    trigger_key: 'dolor_pleuritico_disnea',
    terms: [/\bdolor\s+toracic[oa]\s+pleur[ií]tic[oa]\b.*\bdisnea\b/i, /\bdisnea\b.*\bdolor\s+pleur[ií]tic[oa]\b/i],
    clinical_relevance: 'Combinacion sugiere evento toracico de riesgo.',
    recommended_followup_questions: ['Inicio brusco?', 'Dolor aumenta con inspiracion?'],
    red_flags_to_rule_out: ['TEP', 'neumotorax'],
    severity_hint: 'high',
  },
  {
    category: 'infeccioso_sepsis',
    trigger_key: 'fiebre_deterioro_general',
    terms: [/\bfiebre\s+persistente\b.*\bdeterioro\b/i, /\bdeterioro\s+general\b.*\bfiebre\b/i],
    clinical_relevance: 'Patron compatible con infeccion sistémica que requiere seguimiento estrecho.',
    recommended_followup_questions: ['Duracion de fiebre?', 'Compromiso hemodinamico o confusional?'],
    red_flags_to_rule_out: ['sepsis', 'foco infeccioso grave'],
    severity_hint: 'high',
  },
  {
    category: 'infeccioso_sepsis',
    trigger_key: 'hipotension',
    terms: [/\bhipotensi[oó]n\b/i, /\bpresi[oó]n\s+(?:muy\s+)?baja\b/i],
    clinical_relevance: 'Hipotension reportada en contexto infeccioso aumenta riesgo de sepsis.',
    recommended_followup_questions: ['TA medida y tendencia?', 'Perfusion periferica alterada?'],
    red_flags_to_rule_out: ['shock septico', 'hipoperfusion organica'],
    severity_hint: 'high',
  },
  {
    category: 'infeccioso_sepsis',
    trigger_key: 'confusion_infecciosa',
    terms: [/\bconfusi[oó]n\b/i],
    clinical_relevance: 'Confusion en posible cuadro infeccioso requiere evaluacion prioritaria.',
    recommended_followup_questions: ['Inicio agudo?', 'Fiebre o foco asociado?'],
    red_flags_to_rule_out: ['encefalopatia septica', 'hipoxemia'],
    severity_hint: 'medium',
  },
  {
    category: 'infeccioso_sepsis',
    trigger_key: 'taquicardia',
    terms: [/\btaquicardia\b/i, /\bfc\s*(?:de|:)?\s*(1[1-9]\d|[2-9]\d{2,})\b/i],
    clinical_relevance: 'Taquicardia puede indicar respuesta sistemica al estres infeccioso.',
    recommended_followup_questions: ['Frecuencia cardiaca sostenida?', 'Asociacion con hipotension?'],
    red_flags_to_rule_out: ['sepsis en progresion', 'shock'],
    severity_hint: 'medium',
  },
  {
    category: 'infeccioso_sepsis',
    trigger_key: 'inmunosupresion',
    terms: [/\binmunosupresi[oó]n\b/i, /\bneutropenia\b/i, /\bquimioterapia\b/i],
    clinical_relevance: 'Inmunosupresion aumenta riesgo de infecciones graves.',
    recommended_followup_questions: ['Tratamientos inmunosupresores actuales?', 'Fiebre y foco probable?'],
    red_flags_to_rule_out: ['neutropenia febril', 'sepsis oculta'],
    severity_hint: 'high',
  },
  {
    category: 'digestivo_abdominal',
    trigger_key: 'dolor_abdominal_intenso_persistente',
    terms: [/\bdolor\s+abdominal\s+intenso\b/i, /\bdolor\s+abdominal\b.*\bpersistente\b/i],
    clinical_relevance: 'Dolor abdominal intenso persistente requiere evaluacion de abdomen agudo.',
    recommended_followup_questions: ['Localizacion e irradiacion?', 'Asocia fiebre, vomitos o defensa?'],
    red_flags_to_rule_out: ['abdomen agudo quirurgico', 'isquemia intestinal'],
    severity_hint: 'high',
  },
  {
    category: 'digestivo_abdominal',
    trigger_key: 'abdomen_rigido',
    terms: [/\babdomen\s+r[ií]gido\b/i, /\bdefensa\s+abdominal\b/i],
    clinical_relevance: 'Signos peritoneales requieren priorizacion clinica inmediata.',
    recommended_followup_questions: ['Dolor a la descompresion?', 'Inicio y progresion del cuadro?'],
    red_flags_to_rule_out: ['peritonitis', 'perforacion visceral'],
    severity_hint: 'high',
  },
  {
    category: 'digestivo_abdominal',
    trigger_key: 'vomitos_persistentes',
    terms: [/\bv[oó]mitos?\s+persistentes?\b/i],
    clinical_relevance: 'Vomitos persistentes pueden generar deshidratacion y trastornos metabolicos.',
    recommended_followup_questions: ['Numero de episodios y tolerancia oral?', 'Sangre en vomito?'],
    red_flags_to_rule_out: ['deshidratacion severa', 'obstruccion intestinal'],
    severity_hint: 'medium',
  },
  {
    category: 'digestivo_abdominal',
    trigger_key: 'sangre_materia_fecal',
    terms: [/\bsangre\s+en\s+materia\s+fecal\b/i, /\bhematochezia\b/i, /\bmelena\b/i],
    clinical_relevance: 'Sangrado digestivo requiere estratificacion de severidad.',
    recommended_followup_questions: ['Cantidad y color de sangre?', 'Mareos o lipotimia?'],
    red_flags_to_rule_out: ['hemorragia digestiva significativa', 'inestabilidad hemodinamica'],
    severity_hint: 'high',
  },
  {
    category: 'digestivo_abdominal',
    trigger_key: 'ictericia_fiebre',
    terms: [/\bictericia\b.*\bfiebre\b/i, /\bfiebre\b.*\bictericia\b/i],
    clinical_relevance: 'Ictericia con fiebre sugiere posible compromiso hepatobiliar infeccioso.',
    recommended_followup_questions: ['Coluria/acolia presentes?', 'Dolor en hipocondrio derecho?'],
    red_flags_to_rule_out: ['colangitis', 'sepsis biliar'],
    severity_hint: 'high',
  },
  {
    category: 'obstetrico_ginecologico',
    trigger_key: 'sangrado_embarazo',
    terms: [/\bsangrado\b.*\bembarazo\b/i, /\bembarazo\b.*\bsangrado\b/i],
    clinical_relevance: 'Sangrado en embarazo requiere evaluacion obstetrica prioritaria.',
    recommended_followup_questions: ['Edad gestacional?', 'Dolor asociado y cantidad de sangrado?'],
    red_flags_to_rule_out: ['amenaza de aborto', 'embarazo ectopico'],
    severity_hint: 'high',
  },
  {
    category: 'obstetrico_ginecologico',
    trigger_key: 'dolor_abdominal_embarazo',
    terms: [/\bdolor\s+abdominal\b.*\bembarazo\b/i, /\bembarazo\b.*\bdolor\s+abdominal\b/i],
    clinical_relevance: 'Dolor abdominal en embarazo requiere anamnesis dirigida y control.',
    recommended_followup_questions: ['Edad gestacional y localizacion del dolor?', 'Sangrado o contracciones?'],
    red_flags_to_rule_out: ['embarazo ectopico', 'desprendimiento placentario'],
    severity_hint: 'high',
  },
  {
    category: 'obstetrico_ginecologico',
    trigger_key: 'cefalea_intensa_embarazo',
    terms: [/\bcefalea\s+intensa\b.*\bembarazo\b/i, /\bembarazo\b.*\bcefalea\s+intensa\b/i],
    clinical_relevance: 'Cefalea intensa en embarazo requiere control clinico oportuno.',
    recommended_followup_questions: ['Cambios visuales?', 'TA disponible?'],
    red_flags_to_rule_out: ['preeclampsia', 'emergencia hipertensiva'],
    severity_hint: 'high',
  },
  {
    category: 'obstetrico_ginecologico',
    trigger_key: 'disminucion_movimientos_fetales',
    terms: [/\bdisminuci[oó]n\s+de\s+movimientos?\s+fetales?\b/i],
    clinical_relevance: 'Disminucion de movimientos fetales requiere valoracion obstetrica.',
    recommended_followup_questions: ['Desde cuando disminuyeron?', 'Edad gestacional actual?'],
    red_flags_to_rule_out: ['compromiso fetal agudo'],
    severity_hint: 'high',
  },
  {
    category: 'pediatrico',
    trigger_key: 'dificultad_respiratoria_pediatrica',
    terms: [/\bdificultad\s+respiratoria\b/i, /\baleteo\s+nasal\b/i, /\btiraje\b/i],
    clinical_relevance: 'Dificultad respiratoria en pediatria requiere evaluacion prioritaria.',
    recommended_followup_questions: ['Edad del paciente?', 'Se alimenta y oxigena adecuadamente?'],
    red_flags_to_rule_out: ['insuficiencia respiratoria pediatrica'],
    severity_hint: 'high',
  },
  {
    category: 'pediatrico',
    trigger_key: 'rechazo_alimentario_persistente',
    terms: [/\brechazo\s+alimentario\s+persistente\b/i, /\bno\s+quiere\s+comer\b/i],
    clinical_relevance: 'Rechazo alimentario persistente puede indicar compromiso sistemico.',
    recommended_followup_questions: ['Cuantas tomas perdidas?', 'Diuresis disminuida?'],
    red_flags_to_rule_out: ['deshidratacion', 'infeccion severa'],
    severity_hint: 'medium',
  },
  {
    category: 'pediatrico',
    trigger_key: 'somnolencia_marcada',
    terms: [/\bsomnolencia\s+marcada\b/i, /\bletarg(?:ia|ico)\b/i],
    clinical_relevance: 'Somnolencia marcada en ninos requiere evaluacion inmediata.',
    recommended_followup_questions: ['Despierta con estimulo?', 'Fiebre o convulsiones asociadas?'],
    red_flags_to_rule_out: ['depresion neurologica aguda'],
    severity_hint: 'high',
  },
  {
    category: 'pediatrico',
    trigger_key: 'fiebre_lactante_pequeno',
    terms: [/\bfiebre\b.*\blactante\b/i, /\blactante\b.*\bfiebre\b/i],
    clinical_relevance: 'Fiebre en lactante pequeno requiere triage priorizado.',
    recommended_followup_questions: ['Edad en meses?', 'Signos de mala perfusion?'],
    red_flags_to_rule_out: ['infeccion bacteriana invasiva'],
    severity_hint: 'high',
  },
  {
    category: 'pediatrico',
    trigger_key: 'convulsiones_pediatricas',
    terms: [/\bconvulsi[oó]n(?:es)?\b/i],
    clinical_relevance: 'Convulsiones en pediatria requieren evaluacion urgente y seguimiento.',
    recommended_followup_questions: ['Duracion de episodio?', 'Recuperacion neurologica posterior?'],
    red_flags_to_rule_out: ['estatus convulsivo', 'infeccion SNC'],
    severity_hint: 'high',
  },
];

function sanitizeForMemorySafeSummary(input: string): string {
  return input
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[phi_email_redacted]')
    .replace(/(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g, '[phi_phone_redacted]')
    .replace(/\b(?:dni|documento|passport|pasaporte|ssn|cuit|cuil|rut)\s*[:#-]?\s*[A-Z0-9.\-]{5,}\b/gi, '[phi_document_redacted]')
    .replace(/\b(?:direccion|address|domicilio|calle|avenida|av\.?|street)\b[^,.\n]{0,80}/gi, '[phi_address_redacted]')
    .replace(/\b(?:paciente|nombre)\s*[:\-]?\s*[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2}/gi, '[phi_name_hint_redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export function detect_critical_clinical_triggers(
  texto: string,
  _contexto: Record<string, unknown> | null = null,
): ClinicalTrigger[] {
  const normalized = String(texto ?? '');
  if (!normalized.trim()) {
    return [];
  }

  const detected: ClinicalTrigger[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    const matched_terms: string[] = [];
    for (const term of rule.terms) {
      const match = normalized.match(term);
      if (match?.[0]) {
        matched_terms.push(match[0]);
      }
    }

    if (matched_terms.length === 0) {
      continue;
    }

    if (seen.has(rule.trigger_key)) {
      continue;
    }
    seen.add(rule.trigger_key);

    detected.push({
      category: rule.category,
      trigger_key: rule.trigger_key,
      matched_terms: Array.from(new Set(matched_terms)).slice(0, 6),
      clinical_relevance: rule.clinical_relevance,
      recommended_followup_questions: rule.recommended_followup_questions,
      red_flags_to_rule_out: rule.red_flags_to_rule_out,
      severity_hint: rule.severity_hint,
      memory_safe_summary: sanitizeForMemorySafeSummary(
        `Trigger ${rule.trigger_key} detectado. Relevancia: ${rule.clinical_relevance}`,
      ),
      phi_safe: true,
    });
  }

  return detected;
}
