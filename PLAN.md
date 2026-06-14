# PLAN: MMSS Mutator on `abstract-mind-lab`

## Goal

Create a new UI section named `Мутатор MMSS` based on the current `ASE Console / Python Generation` workflow, but sourced primarily from PostgreSQL data in `abstract-mind-lab`, with all generated results persisted back into `abstract-mind-lab`.

Add an optional checkbox to include legacy data from `abstract_mind_db`.

If the checkbox is disabled:
- use only `abstract-mind-lab`

If the checkbox is enabled:
- build the generation runtime from `abstract-mind-lab` first
- enrich/fallback from `abstract_mind_db`
- still save generated results into `abstract-mind-lab`

## Research Summary

### 1. Current Python Generation architecture

The current `PythonGenerationLayer.js` is a browser-side port of several Python generation modules:
- `builder.py`
- `builder_v3.py`
- `mutation_engine.py`
- `crossover_engine.py`
- `memory_v3.py`
- `self_rule_engine.py`

The layer currently expects a normalized in-memory runtime:
- `blockIndex.blocks`
- `graph.edges`
- `embeddings.blocks`

The runtime is currently built from Prompt Library blocks via:
- `buildGenerationRuntimeFromPromptLibrary(promptBlocks)`

This means the generation engine is already modular enough to accept another source, as long as we can map DB records into the same runtime shape.

### 2. Current UI entry point

The existing `Python Generation` tab lives in:
- `react/my-app/src/components/AseIdeWorkspace.jsx`

It renders:
- `react/my-app/src/components/ase-variations/generation-engine-panel.jsx`

This is the cleanest base for creating a sibling tab:
- `Мутатор MMSS`

### 3. Existing DB-backed block models

There are already useful block-oriented models and routes:

- `database/models.py`
  - `MusicBlock`
  - `Song`
  - `ChatSession`
  - `MediaAsset`
  - `SongLyrics`
  - `LyricsTimingMarker`

- `abstract-mind-lab/backend/api/routes/music_blocks.py`
  - CRUD-style access for `music_blocks`

This is important because the Mutator should not rely only on `music_blocks`. It should derive a richer runtime from:
- curated `music_blocks`
- tracks/songs
- chat/session payloads
- lyrics and timing markers
- media metadata

### 4. Main mismatch to solve

`PythonGenerationLayer` expects compact semantic blocks with fields like:
- `id`
- `domain`
- `layer`
- `priority`
- `confidence`
- `phase`
- `tags`
- `params`
- `intent`
- `mutation_ready`
- `crossover_ready`

But `abstract-mind-lab` stores source data in heterogeneous shapes:
- normalized rows
- JSONB payloads
- session snapshots
- song raw metadata

So the core task is not UI cloning. The core task is high-quality runtime synthesis from DB records.

## Quality Strategy

### Priority

Prefer high signal over raw volume.

The Mutator should work from a weighted, typed synthesis of DB facts, not a naive dump of all rows.

### Canonical source order

When building the generation runtime:

1. `abstract-mind-lab.music_blocks`
   - highest priority curated source
   - already closest to generation blocks

2. `abstract-mind-lab.tracks` / `songs`
   - strong source for intent, prompt, duration, popularity, generation mode, structure

3. `abstract-mind-lab.sessions` / `chat_sessions`
   - strong source for semantic context, user intent, JSON prompts, tool-call lineage, video/audio workflow patterns

4. `abstract-mind-lab.song_lyrics` + timing markers
   - useful for language, segmentation, rhythm and structure inference

5. `abstract_mind_db`
   - optional enrichment only when checkbox is enabled
   - use as auxiliary memory/fallback, not as canonical overwrite source

## Proposed Runtime Mapping

### A. Native block source: `music_blocks`

Map directly into generation blocks:
- `id` <- `id` or `slug`
- `intent` <- `name` + semantic summary of `content`
- `params` <- `content`
- `layer` <- `layer`
- `domain` <- inferred from `block_type`, `slug`, `name`, `content`
- `tags` <- `[block_type, layer, slug tokens, content keys]`
- `priority` <- derived from explicit score fields in `content`, else fallback heuristic
- `confidence` <- derived from explicit metadata or curation heuristic

### B. Track-derived pseudo-blocks

Generate pseudo-blocks from tracks/songs when no curated block exists or when enrichment is needed.

Candidate source fields:
- title
- prompt / sound prompt
- generation_mode / op_type / transform_type
- play_count
- favorite_count
- duration
- lyrics presence
- lyrics timing density
- privacy/discoverability
- raw JSON keys

Map:
- `domain`
  - rhythm: timing markers, BPM-like language, beat/groove tokens
  - timbre: texture/instrument/tonal descriptors
  - space: ambient/stereo/field/spatial tokens
  - logic/math: structured JSON prompts, transformation rules, schema-heavy prompts

- `layer`
  - infer from track type, metadata density, transform depth, or prompt semantics

- `priority`
  - blend of favorites, plays, metadata completeness, prompt richness

- `confidence`
  - higher if track has:
    - prompt
    - session link
    - raw data
    - lyrics or timing data
    - stable operation metadata

### C. Session-derived pseudo-blocks

Use sessions as high-value intent/context blocks.

Extract from:
- user prompts
- assistant/tool messages
- tool arguments
- structured JSON prompts
- repeated flow/memory patterns
- video/audio generation workflows

Map:
- `intent`
  - concatenated high-value prompt text

- `params`
  - extracted JSON fragments
  - tool args
  - summarized workflow metadata

- `tags`
  - tool names
  - message kinds
  - flow names
  - memory names
  - generation modalities

- `domain`
  - inferred from prompt semantics and tool usage

- `phase`
  - inferred from conversation stage:
    - ideation
    - refinement
    - render
    - mutation
    - review

### D. Graph construction

Build `graph.edges` from real relationships, not just token similarity.

Edge sources:
- same session
- same flow
- same track/session lineage
- shared tool patterns
- shared prompt token clusters
- shared `video_job_id` / generation linkage
- block-to-track and block-to-session affinities

Edge scoring dimensions:
- shared domain
- nearby layer
- overlapping tags
- shared session
- same generation family
- semantic similarity from prompt/JSON text

### E. Embeddings / query vectors

Do not introduce external embeddings first.

Phase 1 should use deterministic bag-of-words / tf-like vectors from:
- block name
- prompt text
- JSON keys
- tags
- tool names
- flow/memory labels

This matches the existing `buildQueryVector()` design and is cheap, explainable, and debuggable.

## Database Strategy

### Read path

Create a dedicated runtime loader for the Mutator:
- query `abstract-mind-lab`
- optionally query `abstract_mind_db`
- normalize both into one intermediate schema
- deduplicate by semantic identity and source priority

### Save path

All newly generated artifacts should be stored in `abstract-mind-lab`.

Preferred persistence targets:

1. `music_blocks`
   - for generated/mutated/crossover/self-rule outputs

2. generation memory table or persisted JSON setting
   - if staying consistent with current `memory_v3`, we can first persist via app settings
   - later promote to dedicated DB table if needed

### Legacy DB checkbox behavior

Checkbox label:
- `Подключать abstract_mind_db`

Behavior:
- off: query only `abstract-mind-lab`
- on: query both

Merge rules:
- `abstract-mind-lab` wins on collisions
- `abstract_mind_db` only fills gaps or adds supplemental candidates

## Implementation Phases

### Phase 1: Runtime Loader

Create a new service for DB-backed generation runtime, separate from Prompt Library runtime:
- load canonical rows from `abstract-mind-lab`
- optionally load from `abstract_mind_db`
- output:
  - `blockIndex`
  - `graph`
  - `embeddings`
  - `stats`
  - source diagnostics

Likely files:
- `react/my-app/src/services/MMSSMutatorRuntimeService.js`
- optional backend query support in `archiver-server.js`

### Phase 2: Mutator UI

Create new tab/section:
- `Мутатор MMSS`

Base it on `generation-engine-panel.jsx`, but replace Prompt Library sync with runtime sync from DB.

Required controls:
- intent
- domains
- layers
- max blocks
- temperature
- runs
- checkbox `Подключать abstract_mind_db`
- runtime diagnostics:
  - blocks loaded
  - tracks mapped
  - sessions mapped
  - legacy enrichment count

### Phase 3: Save-to-DB

Add save flow so build/mutation/crossover/self-rules can persist into `abstract-mind-lab.music_blocks`.

Need:
- deterministic slug generation
- explicit block type categories:
  - `mutator_build`
  - `mutator_mutation`
  - `mutator_crossover`
  - `mutator_self_rule`

### Phase 4: Quality Tuning

Tune heuristics using real data:
- prompt-rich sessions
- JSON-heavy sessions
- track popularity weighting
- lyric timing usefulness
- session/tool lineage

### Phase 5: Diagnostics

Add runtime introspection panel:
- source counts by DB
- top inferred domains
- top inferred layers
- rejected records count
- duplicate merge count

This is necessary because mapping quality will otherwise be opaque.

## Risks

### 1. Overfitting to noisy JSON

Session payloads contain a lot of operational JSON. Without filtering, it will pollute tags and vectors.

Mitigation:
- whitelist meaningful JSON keys
- downweight transport/system keys

### 2. Legacy DB conflicts

`abstract_mind_db` may have older or differently shaped records.

Mitigation:
- never let legacy overwrite canonical `abstract-mind-lab`
- keep per-record `source_db`

### 3. Semantic sparsity in `music_blocks`

If curated blocks are too few, generation quality may collapse.

Mitigation:
- hybrid runtime from `music_blocks` + track pseudo-blocks + session pseudo-blocks

### 4. Save schema ambiguity

Generated outputs may not fit existing `music_blocks` semantics perfectly.

Mitigation:
- store raw generation result in `content`
- use explicit `block_type`
- keep provenance metadata in `content.meta`

## Deliverables

1. New UI section `Мутатор MMSS`
2. DB-backed runtime loader from `abstract-mind-lab`
3. Optional enrichment checkbox for `abstract_mind_db`
4. Proper normalization/mapping into `PythonGenerationLayer` runtime schema
5. Save generated results into `abstract-mind-lab`
6. Runtime diagnostics for mapping quality

## Recommended Build Order

1. Implement DB runtime loader and diagnostics first
2. Wire new UI tab `Мутатор MMSS`
3. Reuse current generation algorithms unchanged
4. Add save-to-DB
5. Tune heuristics on real records

This order minimizes risk and keeps the existing generation logic stable while replacing only the source runtime.

## MMSS Ontology Layer

### Explicit Ontology Over Blocks

Introduce an explicit MMSS ontology layer above the generic runtime block shape.

New metadata layer:
- `mmss_role`
- `mmss_stage`
- `mmss_archetype`
- `phase_operator_id`
- `domain_operator_id`
- `ontology_source`
- `invariants_confidence`

This ontology must be persisted in:
- `music_blocks.content.mmss_meta`

And ideally normalized into dedicated PostgreSQL tables:
- `mmss_phase_patterns`
- `mmss_domain_patterns`

### Canonical Phase Ontology

The `invariants_extractor` repository provides a deterministic offline phase model in:
- `invariants_extractor/backend/agents/offline_agent.py`

Canonical phase operators:
- `init`
- `stabilize`
- `vectorize`
- `commute`
- `convolve`
- `relax`
- `focus`

These should be treated as the primary phase ontology for session-derived pseudo-blocks.

### Domain Ontology Extension

Extend the same pattern mechanism to MMSS domains:
- `rhythm`
- `timbre`
- `space`
- `logic`
- `math`

### Ontology Seed Source

Use a seed file as the bootstrap source of truth:
- `database/seeds/mmss_ontology_seed.json`

Requirements:
- editable by hand
- importable into PostgreSQL
- loadable in runtime as fallback if DB tables are empty

## Session Pseudo-Blocks with Invariants Extractor

### Why use it

The `invariants_extractor` adds deterministic structural extraction on top of textual and JSON-heavy session material.

This is especially useful for pseudo-blocks derived from:
- user prompts
- assistant messages
- tool-call arguments
- tool-return payloads
- structured JSON prompts
- repeated flow/memory traces
- audio/video generation workflows

### Extraction Pipeline

For session-derived pseudo-blocks:

1. Extract semantically meaningful text fragments from session payloads.
2. Normalize them into analyzable chunks.
3. Run phase/domain matching using MMSS ontology patterns.
4. Store the result as MMSS meta attached to the pseudo-block.

Expected output fields:
- `phase_hits`
- `domain_hits`
- `dominant_phase`
- `dominant_domain`
- `confidence_breakdown`
- `synthetic_flags`

### Impact on Runtime Mapping

Pseudo-blocks generated from sessions should no longer be tagged only by loose semantic heuristics.

They should also include:
- deterministic phase hints from `invariants_extractor`
- deterministic domain hints from MMSS ontology patterns
- confidence boosted when both semantic and ontology signals agree

## Runtime Quality Improvements

### MMSS Role Coverage

The runtime should aim to assemble not just semantically relevant blocks, but usable MMSS configurations.

Target coverage types:
- `seed`
- `constraint`
- `style_filter`
- `operator`
- `critic`
- `composer`
- `macro_flow`

Add a runtime metric:
- `mmss_completeness`

This estimates how well a candidate block set covers key MMSS roles.

### Exploration vs Production Modes

Add two loader presets:

#### Exploration
- more session pseudo-blocks
- lower confidence threshold
- more legacy enrichment
- higher diversity cap

#### Production
- stronger bias to curated `music_blocks`
- strict confidence/priority filters
- limited noisy session material
- better reproducibility

### Mutation Recipes

The Mutator should support reusable recipes instead of only one-shot runs.

Recipe concept:
- serialized JSON describing ordered steps such as:
  - select seeds
  - generate session pseudo-blocks
  - apply crossover
  - apply mutation
  - run self-rule critic

Persistence options:
- separate `mmss_recipes` table
- or `music_blocks` with `block_type = 'mutator_recipe'`

### JSON Normalization Pipeline

Formalize preprocessing for noisy JSON payloads:

1. schema detection
2. key whitelisting
3. noise-key suppression
4. enum/value normalization
5. semantic compression for oversized JSON blobs

This should happen before:
- tags generation
- params generation
- query vector generation
- ontology matching

### Vector Backend Abstraction

Keep bag-of-words as v1, but introduce an abstraction layer for future vector modes:
- `bow`
- `external_llm`
- `hybrid`

The mutator runtime service should call a backend interface instead of hardcoding one vector strategy.

### Legacy Echo Merge

If legacy DB is enabled, do more than fallback fill.

Use legacy as shadow memory:
- detect historical echoes of canonical blocks
- boost confidence when a block pattern recurs historically
- keep conflicting alternatives as mutation branches, not primary runtime replacements

Diagnostics should expose:
- `legacy_echo_matches`
- `legacy_conflicts`
- `legacy_only_candidates`

### MMSS Inspector

Diagnostics should evolve into a proper inspector with views for:
- source overview
- role coverage
- graph topology
- filter replay
- ontology hit coverage

### Self-Eval Loop

Persist evaluation artifacts for generated outputs:
- `mutator_eval`

Use them later as constraints for future runs through self-rule feedback.

### Heuristics Sandbox

Add a dev-only heuristic sandbox so rules can be toggled quickly without rewriting the whole runtime.

Example rule style:
- if source is session and tool is video generation, boost space or logic domain
- if prompt is JSON-heavy and structurally rich, boost logic confidence

## Phase Refactor

### Phase 1: Canonical Runtime + MMSS Meta

Focus:
- DB runtime loader
- MMSS ontology load path
- phase/domain inference
- vector backend contract

### Phase 2: Mutator UI + Recipes

Focus:
- new `Мутатор MMSS` UI
- runtime source controls
- checkbox for `abstract_mind_db`
- recipe support

### Phase 3: Persistence + Provenance

Focus:
- generated block persistence
- provenance metadata
- recipe linkage
- self-rule evaluation blocks

### Phase 4: Heuristics Sandbox

Focus:
- configurable mapping heuristics
- reloadable runtime rules
- diagnostics of rule impact

### Phase 5: MMSS Inspector

Focus:
- source/domain/phase coverage
- topology and block role analysis
- rejection and merge traces

## Local RAG -> Local LLM

### Current Status

Already ready:
- local embedding model `embeddinggemma:300m`
- local vector store in PostgreSQL
- semantic retrieval via `Local LLM RAG`
- two-database support
- local model `batiai/gemma4-e2b:q4` installed in Ollama

Not yet complete:
- context assembler for LLM-ready prompts
- backend answer-generation route on top of retrieval
- provenance-aware UI answer mode

### Recommended Next Steps

1. Add backend `buildPromptContext` layer on top of `searchRag`
2. Add `POST /api/rag/answer`
3. Call local Ollama model `batiai/gemma4-e2b:q4`
4. Return answer plus retrieved sources and debug metadata
5. Extend `Local LLM RAG` panel with `Generate Answer`

### Core Principle

Do not pass raw vectors into the local LLM.

Correct pipeline:

`DB rows -> embeddings -> pgvector retrieval -> compact text context -> batiai/gemma4-e2b:q4`

### Status Update 2026-06-14

Implemented:
- `searchRag -> buildPromptContext -> answerWithRag`
- local Ollama answer generation via `batiai/gemma4-e2b:q4`
- cross-database retrieval through `sourceScopes`
- multi-query retrieval budgeting through `queryBudget` in the range `1..100`
- dynamic retrieval templates for:
  - `qa`
  - `prompt_mutation`
  - `session_analysis`
  - `mmss_operator_assist`
  - `cross_db_reconciliation`
  - `json_prompt_extraction`
  - `source_audit`
  - `ase_console_recipe`

Verified:
- cross-DB retrieval from `abstract-mind-lab/tracks,sessions` plus `abstract_mind_db/music_blocks`
- prompt context assembly on top of merged retrieval
- end-to-end local answer generation with source provenance

### Next UI Layer

The next improvement should not change retrieval semantics. It should reorganize presentation:

1. Split `Local LLM RAG` outputs into FlexLayout tabs:
   - `Search Results`
   - `Prompt Context`
   - `Answer`
   - `Source Inspector`
   - `Debug`
2. Add action buttons near JSON panels:
   - `Save to DB`
   - `Vectorize Result`
3. Persist panel positions and selected tabs in workspace state.
4. Add semantic color coding and icons for:
   - source type
   - database origin
   - relation vs primary blocks
   - JSON vs plain-text fragments
