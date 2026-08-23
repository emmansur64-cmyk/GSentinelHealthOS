# ADR-0001: ClinicalKernel como autoridad absoluta

- Estado: aceptado para Fase 0
- Fecha: 2026-08-23

## Decision

El ClinicalKernel externo posee la autoridad clinica completa. Su orquestador
interno selecciona y secuencia los 11 motores. Los motores son productores
parciales; la decision final pertenece al Kernel. Sistemas externos solo pueden
entregar entradas tipadas o consumir proyecciones autorizadas.

## Consecuencias

- No habra un orquestador clinico paralelo en MB-Chat, PanelDoctor o proveedores.
- Ningun motor sera invocable como API publica independiente.
- Toda integracion futura usara un contrato versionado y fail-closed.
- Un LLM no decide motores ni medicina y no puede corregir una salida bloqueada.
- Los cambios de conocimiento y politica necesitaran gobernanza verificable.
