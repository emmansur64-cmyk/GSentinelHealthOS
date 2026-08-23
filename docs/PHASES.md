# Hoja de ruta: Fase 0 a Fase 6

Son siete fases numeradas de 0 a 6. Ninguna fase se cierra por compilar solamente.

## Fase 0 - arquitectura maestra

Autoridad, contratos, fronteras, registro de 11 motores, grafo, planificador,
estados de fallo, trazabilidad y criterios de cierre.

## Fase 1 - hechos, temporalidad e intake

Modelo de hechos clinicos tipados, identidad/revision del caso, procedencia,
normalizacion de unidades, temporalidad y validacion. No se ejecuta razonamiento
sobre texto crudo.

Estado: **cerrada en alcance estructural**. Incluye contratos base, intake
autoritativo, hash canonico, temporalidad explicita, terminologia y unidades
gobernadas, revisiones/deltas, errores tipados, idempotencia por `request_id`,
aislamiento de caso y persistencia SQLite transaccional. El cierre no representa
validacion clinica ni habilitacion productiva.

## Fase 2 - conocimiento y evidencia gobernados

Releases inmutables y versionados, fuentes, vigencia, poblacion, conflictos,
activacion/rollback y verificacion criptografica. La evidencia queda separada de
los hechos del paciente.

Estado: **cerrada en alcance estructural**. Existen manifiestos, verificacion
Ed25519 mediante clave publica externa, activacion/rollback durable y recibos,
conflictos, lookup determinista, `EvidenceNeed` PHI-minimal, gateway gobernado y
contrato de entrada al futuro razonamiento. El cierre no incorpora reglas
medicas reales, adjudicacion clinica ni habilitacion productiva.

## Fase 3 - implementacion aislada de los 11 motores

Cada motor obtiene contrato de entrada/salida, invariantes, abstencion,
procedencia, pruebas unitarias y benchmarks. No hay acceso directo motor-a-motor.

## Fase 4 - orquestador total y estado unificado

Politica de seleccion por caso, cierre de dependencias, ejecucion, reintentos
seguros, presupuestos, adjudicacion, decision unica, `UnifiedClinicalState`,
snapshots e idempotencia.

## Fase 5 - integracion, seguridad y explicacion

API externa autenticada, aislamiento, proyecciones allow-list, narrador/LLM
confinado, controles de contradiccion/omision, observabilidad y fallos cerrados.

## Fase 6 - validacion y promocion controlada

Gold sets gobernados, ablation por motor, pruebas longitudinales y adversariales,
latencia/carga, revision clinica externa, shadow/canary, rollback y evidencia de
la ruta real. Solo esta fase puede proponer habilitacion productiva.
