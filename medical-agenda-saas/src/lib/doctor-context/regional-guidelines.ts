export function buildRegionalGuidelines(country: string, region: string | null): string[] {
  const normalized = country.trim().toUpperCase();
  if (normalized === "AR" || normalized === "ARGENTINA") {
    return [
      "Adaptar terminologia y contexto sanitario a Argentina cuando sea relevante.",
      "No afirmar protocolos nacionales especificos si no fueron provistos por retrieval o contexto institucional.",
      region ? `Usar la region ${region} solo como contexto general, no como ubicacion sensible del paciente.` : "",
    ].filter(Boolean);
  }

  return [
    "Usar recomendaciones clinicas generales si no hay guia regional explicita.",
    "No inventar normativas locales ni disponibilidad institucional.",
  ];
}
