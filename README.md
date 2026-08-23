# ClinicalKernel externo

Este repositorio contiene un ClinicalKernel independiente. Su objetivo es ser la
unica autoridad capaz de convertir hechos clinicos tipados en una decision
clinica trazable. Los adaptadores, proveedores, interfaces y modelos de lenguaje
son consumidores o fuentes controladas; nunca son autoridades paralelas.

Estado actual: **Fase 2 - cierre estructural de integridad completado**.

La Fase 0 incluye:

- contratos de ejecucion y autoridad;
- catalogo cerrado de los 11 motores;
- planificador determinista del orquestador;
- invariantes fail-closed;
- hoja de ruta de Fase 0 a Fase 6;
- pruebas estructurales, sin reglas medicas productivas.

La Fase 1 agrega un limite de entrada gobernado por el Kernel: hechos tipados e
inmutables, procedencia obligatoria, temporalidad explicita, hashes canonicos y
unidades que solo pueden normalizarse mediante reglas versionadas.

El cierre estructural agrega fingerprints SHA-256 sobre JSON canonico,
transiciones atomicas equivalentes en memoria/SQLite, validacion gobernada de
tipo-concepto-unidad, releases de conocimiento durables, recibos de activacion
y firmas Ed25519 verificadas con una clave publica externa.

Documentacion principal:

- [Arquitectura maestra](docs/MASTER_ARCHITECTURE.md)
- [Plan de fases](docs/PHASES.md)
- [Fase 1: hechos e intake](docs/PHASE1_FACTS_AND_INTAKE.md)
- [Fase 2: conocimiento y evidencia](docs/PHASE2_KNOWLEDGE_AND_EVIDENCE.md)
- [ADR de autoridad](docs/adr/0001-kernel-como-autoridad-absoluta.md)

Validacion local:

```powershell
py -3.12 -m pytest
```

La clave privada de firma no pertenece a este repositorio ni al runtime del
Kernel. `Ed25519KnowledgeVerifier` recibe solamente la ruta operatoria a una
clave publica PEM externa.

La arquitectura no equivale todavia a validacion clinica ni habilita uso
productivo.
