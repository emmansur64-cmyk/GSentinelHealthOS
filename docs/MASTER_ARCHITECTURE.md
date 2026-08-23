# Fase 0 - arquitectura maestra

## 1. Regla constitucional

El ClinicalKernel es la unica autoridad clinica del sistema. El orquestador es
un componente interno del Kernel y gobierna los 11 motores. Ningun motor puede
invocarse productivamente por fuera de ese limite; ningun LLM, API, UI,
retriever o adaptador puede seleccionar acciones clinicas ni modificar el
estado clinico consolidado.

La autoridad tiene esta direccion unica:

```text
Entrada externa
  -> validacion y hechos tipados
  -> ClinicalKernel
       -> orquestador de politica
       -> seleccion del subgrafo de motores
       -> ejecucion y controles
       -> decision clinica unica
       -> estado clinico unificado e inmutable
  -> proyeccion segura
  -> narracion/UI
```

## 2. Limites que no se pueden cruzar

1. Los hechos del paciente, el conocimiento medico, las inferencias, las
   decisiones y el texto visible son dominios separados.
2. La evidencia externa puede respaldar o cuestionar conocimiento; nunca se
   convierte automaticamente en un hecho del paciente.
3. Solo el Kernel publica una decision clinica. Los motores publican resultados
   parciales tipados y no se llaman entre si.
4. El orquestador elige motores mediante politica versionada, capacidades
   requeridas, precondiciones tipadas y dependencias declaradas.
5. El LLM puede verbalizar un resultado autorizado, pero no agregar diagnosticos,
   tratamientos, prioridades ni certezas.
6. Una dependencia ausente, contrato desconocido, firma invalida o conocimiento
   no autorizado cierra la ejecucion: no existe degradacion silenciosa.
7. Todo resultado conserva `request_id`, caso/revision, hash de hechos, version
   de politica, release de conocimiento, motores ejecutados y trazas de origen.

## 3. Los 11 motores y su propietario semantico

| ID | Capacidad unica | Puede producir | No puede hacer |
|---|---|---|---|
| CRE | razonamiento | hipotesis estructuradas | decidir manejo |
| CEE | evaluacion de evidencia | soporte y contradiccion | crear hechos |
| CDR | ranking diagnostico | orden diagnostico | prescribir |
| CPIE | fisiopatologia | mecanismos y relaciones causales | inferir por coocurrencia |
| CCMP | complicaciones | riesgos de complicacion | seleccionar acciones finales |
| CES | sintesis de evidencia | sintesis trazable | alterar hechos del caso |
| CCR | restricciones | contraindicaciones y restricciones | crear un plan final |
| CME | manejo candidato | opciones candidatas estructuradas | publicar la decision final |
| CCFE | confianza | confianza calibrada | ocultar incertidumbre |
| CUE | incertidumbre | brechas que cambian decisiones | inventar certeza |
| CXE | explicabilidad | explicacion ligada a IDs | agregar medicina nueva |

Los nombres conservan los identificadores historicos solo para facilitar la
trazabilidad. La implementacion externa se rige por capacidades y contratos,
no por copiar codigo previo.

## 4. Orquestador total

El orquestador no forma parte de la API publica. La fachada `ClinicalKernel`
recibe el tipo de operacion y la entrada tipada; su politica interna decide las
capacidades. El orquestador trabaja en cinco pasos:

1. valida identidad, revision, integridad y tipo de solicitud;
2. determina capacidades necesarias con una politica firmada/versionada;
3. calcula el cierre de dependencias y un orden topologico;
4. ejecuta cada motor bajo presupuesto, timeout y contrato de salida;
5. adjudica conflictos y construye una unica decision/estado unificado.

No siempre se ejecutan los 11 motores. Un caso se procesa con el subgrafo minimo
seguro. Por ejemplo, pedir explicabilidad requiere CXE y arrastra sus
dependencias; una reevaluacion puede reutilizar resultados solamente si
coinciden revision, hash de hechos, politica y conocimiento.

## 5. Estados y decisiones de ejecucion

Cada motor termina en `SUCCEEDED`, `ABSTAINED`, `INSUFFICIENT_INPUT`,
`BLOCKED_BY_DEPENDENCY` o `FAILED`. El orquestador debe distinguir fallo tecnico,
incertidumbre clinica y ausencia de datos. Ninguno se transforma en una
respuesta segura mediante texto persuasivo.

La decision final del Kernel sera una de:

- `AUTHORIZED`: salida clinica respaldada y trazable;
- `AUTHORIZED_WITH_UNCERTAINTY`: salida limitada con incertidumbre explicita;
- `NEEDS_MORE_DATA`: faltan datos que cambian la decision;
- `ABSTAINED`: el Kernel no puede resolver con autoridad;
- `BLOCKED`: fallo de integridad, seguridad o gobernanza.

## 6. Capas fisicas previstas

```text
clinical_kernel/
  contracts/       contratos publicos, versionados e inmutables
  facts/           hechos clinicos y temporalidad
  knowledge/       releases gobernados y procedencia
  engines/         once implementaciones aisladas
  orchestration/   politica, planner, scheduler y adjudicacion
  state/           UnifiedClinicalState y snapshots
  safety/          validaciones de integridad, no una segunda medicina
  projection/      allow-list para consumidores externos
  audit/           recibos, hashes y trazas
```

El esqueleto actual comprime algunos de estos limites en modulos pequenos; las
fases posteriores los separaran sin cambiar el contrato constitucional.

## 7. Criterio de cierre de Fase 0

- registro exacto de 11 motores y propietario unico por capacidad;
- grafo aciclico, cerrado y validado;
- plan reproducible para la misma entrada/version;
- ausencia de entrada libre de LLM en la seleccion;
- documentos de autoridad y fases aprobados;
- pruebas estructurales verdes;
- declaracion explicita de que no existe aun validacion clinica productiva.
