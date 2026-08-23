# Fase 2 - conocimiento y evidencia gobernados

## Objetivo

El ClinicalKernel elige el release activo de conocimiento y lo vincula al caso.
El cliente ya no puede declarar que version de conocimiento gobierna una
ejecucion. Los documentos externos son evidencia documental: nunca se convierten
automaticamente en hechos del paciente ni en decisiones clinicas.

## Conocimiento versionado

Un `ClinicalKnowledgeRelease` contiene reglas, fuentes, conflictos, hash de
manifiesto y firma externa. Para activarse debe cumplir simultaneamente:

1. estructura e identidades validas;
2. fuentes completas y referenciadas;
3. reglas con revision de gobernanza clinica;
4. ausencia de conflictos sin resolver;
5. hash reproducible;
6. firma aprobada por un verificador externo.

Los releases son inmutables. Activacion y rollback pertenecen al almacen de
conocimiento gobernado, no a la API de casos.

## Evidencia gobernada

`EvidenceNeed` contiene conceptos y reglas, pero no `patient_id`, `case_id`,
texto clinico ni valores del paciente. `EvidenceGateway` permite una sola ronda
por invocacion, un proveedor registrado, dominios permitidos y un maximo de
documentos. Un fallo genera `UNAVAILABLE`; una violacion de politica genera
`REJECTED_BY_POLICY`. En ambos casos el bundle queda vacio.

`EvidenceAssessment` es el unico contrato que puede relacionar un documento con
una regla y exige veredicto, codigo de razon y adjudicador. Ni el gateway ni el
proveedor adjudican por si mismos.

## Frontera con razonamiento clinico

Se incorpora `GovernedReasoningInput` porque es necesario fijar ahora el limite
de consumo de CRE. Solo admite:

- `ClinicalFactSet` y su proyeccion temporal coincidente;
- release y reglas gobernadas;
- evaluaciones de evidencia ligadas a esas reglas.

No se implementa razonamiento clinico en esta fase. El motor CRE y los otros diez
motores pertenecen a la Fase 3 y no podran leer narrativa libre ni resultados de
busqueda sin adjudicar.

## Estado de cierre

Implementado: contratos, manifiestos, SQLite durable, activacion/rollback
transaccional, recibos persistentes, verificacion Ed25519 con clave publica PEM
externa, conflictos, lookup determinista, plan de evidencia PHI-minimal,
gateway y frontera de razonamiento. Las pruebas cubren reinicio, adulteracion,
firma no confiable y rollback durable.

Pendiente para fases posteriores: adjudicacion clinica, reglas medicas reales,
almacen productivo distribuido, gestion operatoria de claves/HSM y validacion
clinica. La clave privada nunca pertenece al Kernel.
