# FINAL LIMITATIONS AND SCOPE

## Que hace MetaBrain hoy

MetaBrain funciona como orquestador, gateway defensivo, reglas, retrieval, auditabilidad parcial, providers existentes y fallback.

## Que NO hace

- No es IA medica autonoma.
- No es radiologo IA real.
- No hace diagnostico definitivo.
- No tiene aprendizaje continuo real activo.
- No tiene multimodalidad medica activa.
- No tiene vector memory activa.
- No tiene DICOM real activo.
- No tiene enforcement clinico activo.
- No tiene observabilidad clinica unificada conectada al runtime.

## Limitaciones medicas

- Requiere criterio medico.
- No reemplaza evaluacion clinica.
- No garantiza exactitud diagnostica.
- No debe emitir decisiones autonomas.

## Limitaciones multimodales

- Image Intelligence es metadata-only/futuro.
- No interpreta lesiones, organos, TAC, RM o placas como especialista.
- DICOM es contrato futuro.

## Limitaciones providers

- Provider Router esta apagado.
- Providers externos futuros requieren PHI policy.
- No hay fallback chain productiva nueva conectada.

## Limitaciones memory

- Semantic memory esta apagada.
- Vector DB no activa.
- Escritura semantica apagada.
- Scope paciente apagado.

## Limitaciones confidence

- Confidence score no es certeza medica.
- No esta calibrado clinicamente.
- No bloquea runtime.

## Limitaciones observability

- No hay exporter externo.
- No hay dashboard real.
- No hay retention policy.
- Capa nueva no esta conectada.

## Limitaciones runtime

- Capas nuevas no estan importadas por runtime.
- No hay DI integration.
- No hay E2E runtime real para estas capas.
