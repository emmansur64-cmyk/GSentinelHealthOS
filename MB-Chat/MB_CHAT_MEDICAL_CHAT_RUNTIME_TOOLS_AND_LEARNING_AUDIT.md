# MB-Chat medical chat runtime tools and learning audit

Date: 2026-05-15
Scope: `MB-Chat` only.

## Implemented

- Added `MedicalRuntimeToolsService` in `MB-Chat/src/medical-assistant/tools/medical-runtime-tools.service.ts`.
- The medical chat now builds controlled runtime context before calling the AI:
  - real current time with timezone `America/Argentina/Buenos_Aires` by default;
  - operational weather via Open-Meteo, without sending patient data;
  - official/academic source allowlist;
  - controlled read of selected official pages from the allowlist, without free browsing;
  - SATI as an Argentina-first critical care source;
  - official Argentina health/news, ANMAT, WHO/PAHO/CDC/PubMed/ClinicalTrials/NICE and selected university medical sources.
- `AiService.answerMedicalQuestion()` now receives the runtime context explicitly and injects it into the RAG prompt.
- Prompt rule added: internet is not free browsing; the model may use only retrieved sources and the controlled tools block.
- Medical chat defaults country context to `AR` when no country is provided.
- Added default Argentina guideline feed candidate for SATI in `MedicalSourcesService`; env `CLINICAL_GUIDELINE_FEEDS` can override it.
- Added `.env.example` variables for timezone and weather controls.
- Added test coverage proving the medical assistant injects the controlled runtime tool context into the AI call.
- Added controlled medical chat learning in `src/medical-assistant/learning/medical-chat-learning.service.ts`.
- The chat now records sanitized learning records with hashed query, extracted concepts, citations, controlled decision and dry-run outcome.
- Explicit teaching phrases such as "aprende" or "recorda" are stored only after redaction and truncation.
- The response includes a `learning` block with the selected controlled decision and confidence.

## Controlled Sources

The official source directory includes:

- SATI: `https://www.sati.org.ar/guias/`
- Ministerio de Salud Argentina: `https://www.argentina.gob.ar/salud`
- Noticias oficiales Ministerio de Salud Argentina: `https://www.argentina.gob.ar/salud/noticias`
- ANMAT: `https://www.argentina.gob.ar/anmat`
- WHO: `https://www.who.int/health-topics` and `https://www.who.int/news`
- PAHO: `https://www.paho.org/`
- CDC: `https://www.cdc.gov/` and `https://www.cdc.gov/media/`
- PubMed/NLM: `https://pubmed.ncbi.nlm.nih.gov/`
- ClinicalTrials.gov: `https://clinicaltrials.gov/`
- NICE guidance: `https://www.nice.org.uk/guidance`
- Harvard Health, Johns Hopkins Medicine, Stanford Medicine.

## Learning Status

Confirmed:

- `MB-Chat/src/learning/learning.service.ts` loads persisted outcome records on module init.
- It records action outcomes through `saveOutcome()`.
- It exposes `getInsights()` from recent outcomes.
- It has a scheduled daily retraining job.
- `MB-Chat/src/persistence/persistence.service.ts` persists outcomes and online-training records.

Important limitation:

- `MB-Chat/memory_py/__init__.py` still states the Python semantic memory adapters are intentionally not wired into current runtime.
- This change wires a TypeScript controlled medical-chat learning path instead of activating free-form Python semantic memory.
- It does not store full patient chat text by default; it stores hashes, concepts, sources and controlled decisions.
- It can store explicit teachings only when the user clearly asks the system to learn/remember, and the text is redacted/truncated first.
- Decisions are controlled dry-run decisions. They do not execute clinical or operational actions.

## Validation

- `npm test -- --runTestsByPath src/medical-assistant/medical-assistant.service.spec.ts`: passed.
- `npm test -- --runTestsByPath src/medical-assistant/learning/medical-chat-learning.service.spec.ts`: passed.
- `npm run build`: passed.

## Boundaries

- No deploy.
- No database changes.
- No migrations.
- No production remote changes.
- Changes kept inside `MB-Chat`.
