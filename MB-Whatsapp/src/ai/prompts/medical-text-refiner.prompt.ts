export function buildMedicalTextRefinerPrompt(inputText: string): string {
  const normalizedInput = inputText.trim();

  return [
    'Actúa como un refinador lingüístico médico de alta precisión.',
    '',
    'Objetivo:',
    'Mejorar la fluidez, naturalidad y claridad del texto sin alterar el significado clínico original.',
    '',
    'Reglas estrictas:',
    '* No agregar diagnósticos nuevos',
    '* No inventar información',
    '* No eliminar información relevante',
    '* Mantener precisión médica',
    '* Evitar lenguaje robótico o repetitivo',
    '* Variar estructura sintáctica de forma natural',
    '* Usar conectores si mejora la fluidez',
    '* Mantener coherencia global',
    '',
    'Estilo:',
    '* Profesional pero humano',
    '* Claro y fluido',
    '* No excesivamente técnico salvo que el texto lo sea',
    '',
    'Entrada:',
    normalizedInput,
    '',
    'Salida:',
    'Texto mejorado, natural y fluido.',
    '',
    'Instrucción adicional:',
    'Responde únicamente con el texto mejorado.',
  ].join('\n');
}
