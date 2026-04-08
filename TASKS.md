# TASK: MMSS_RUNTIME_V3_AND_PROMPT_DB_LOCAL_INTEGRATION

## ROLE

You are a Senior System Architect, Python Engineer, TypeScript Engineer, and Electron/React Integrator.

You write full production-ready code.
You do not provide pseudo-code.
You do not skip files.
You do not leave placeholders like TODO, stub, mock, implement later.

You must return complete working code and integration changes.

---

## PRIMARY GOAL

Build MMSS Runtime V3 and integrate it into the existing repository:

prompt-db-local

The system must support:

1. mutation (generation of new derived blocks)
2. crossover (combining two compatible blocks into a hybrid block)
3. latent embedding instead of simple tags-only matching
4. self-generated rules
5. integration into the existing local-first Electron + React app
6. compatibility with the existing prompt-db-local import/export workflow

---

## CRITICAL FIRST REQUIREMENT

Before implementing V3:

You MUST return the FINAL CLEAN reusable version of:

transform_blocks.py

This is the script that transforms:

producer-ai-base.json
into
prompt-db-local/database/blocks/{domain}/layer{n}/{id}.json

This script must be returned in full.

It must remain reusable for future additions to the database.

---

## REPOSITORY CONTEXT

The target repository already exists and is an Electron + React local-first application.

Important repository facts:

- It imports prompt-like JSON from files and from a Chrome extension.
- It stores imported prompt records in IndexedDB through Dexie.
- It persists service metadata in `.prompt-db-meta/`.
- It already has concepts such as:
  - tag registry
  - element tag bindings
  - key sequence presets
  - export presets
- It already has export generation modes:
  - as-is
  - random-mix
  - sequence-based
- It has Electron main process, React renderer, Dexie DB, Zustand store, and utility modules including:
  - tagScanner.ts
  - tagRegistry.ts
  - keySequenceEngine.ts
  - exportComposer.ts

This means V3 must be integrated as an EXTENSION of the current app, not a separate unrelated project.

---

## HIGH-LEVEL OBJECTIVE

The repository currently behaves like:

raw JSON → local storage → tags / sequences → export

We need to evolve it into:

raw JSON → normalized block system → embeddings → graph → mutation / crossover / self-rules → dynamic export composition

The result must behave like a GENERATIVE MMSS ENGINE inside prompt-db-local.

---

## REQUIRED OUTPUTS

You must produce and integrate the following layers:

### A. Python Runtime Layer
Used for heavy block-system processing and offline generation.

### B. TypeScript / Electron Integration Layer
Used so the existing app can trigger V3 generation and consume results.

### C. React UI Layer
Used so the user can run V3 generation visually from the app.

### D. Persistent Metadata Layer
Used to store embeddings, memory, rules, and generated hybrids.

---

# PART 1 — PYTHON RUNTIME V3

Create the following files.

## 1. transform_blocks.py

Return the FULL transform script first.

Requirements:

- input:
  prompt-db-local/database/producer-ai-base.json

- output:
  prompt-db-local/database/blocks/{domain}/layer{n}/{id}.json

- preserve:
  legacy block fully

- ensure:
  deterministic IDs when possible
  collision-safe IDs when necessary
  reusable script for future dataset expansion

- fields required in each block:
  {
    "id": "...",
    "op": "G | Q | Φ | M",
    "attr": {
      "domain": "Logic | Rhythm | Space | Timbre",
      "phase": "emergence | stabilization | shift | collapse",
      "layer": 1 | 2 | 3,
      "priority": float
    },
    "dna": {
      "seed_ref": "...",
      "params": {}
    },
    "synergy": {
      "links": [],
      "mode": "add | multiply | evolve | mask"
    },
    "meta": {
      "intent": "...",
      "confidence": float
    },
    "legacy": { ... }
  }

---

## 2. indexer_v3.py

Purpose:
Build richer index metadata.

Output:
prompt-db-local/database/system/block_index_v3.json

Format:
{
  "version": "3.0",
  "total_blocks": number,
  "domains": {
    "Rhythm": [],
    "Timbre": [],
    "Space": [],
    "Logic": []
  },
  "blocks": {
    "block_id": {
      "path": "...",
      "domain": "...",
      "layer": number,
      "op": "...",
      "phase": "...",
      "priority": float,
      "confidence": float,
      "tags": [],
      "params_keys": [],
      "embedding_ref": "...",
      "mutation_ready": true,
      "crossover_ready": true
    }
  }
}

Additional requirements:
- extract tags from id, meta.intent, legacy keys, selected legacy values
- normalize tags
- detect if block is mutation-compatible
- detect if block is crossover-compatible
- store embedding_ref

---

## 3. embedding_builder.py

Purpose:
Replace simple tags-only retrieval with latent vector-like matching.

IMPORTANT:
Do not use external cloud APIs.
Do not require heavy ML frameworks.

Use pure Python with standard library or lightweight local dependencies only.

Acceptable implementation:
- hashed bag-of-words
- TF-IDF like weighting
- normalized sparse vector
- cosine similarity
- deterministic local embedding generation

Output:
prompt-db-local/database/system/embeddings.json

Format:
{
  "version": "3.0",
  "embedding_type": "local_sparse_semantic",
  "dimensions": number,
  "blocks": {
    "block_id": {
      "vector": { "term_a": 0.42, "term_b": 0.11 },
      "norm": 1.0
    }
  }
}

Requirements:
- use id
- meta.intent
- tags
- selected legacy keys
- selected legacy short string values
- selected dna.params keys

Also provide:
- similarity(block_a, block_b)
- similarity_to_query(intent_text, block_vector)

---

## 4. graph_builder_v3.py

Purpose:
Build weighted semantic graph.

Output:
prompt-db-local/database/system/graph_v3.json

Format:
{
  "version": "3.0",
  "nodes": [],
  "edges": {
    "block_id": [
      {
        "target": "other_block_id",
        "weight": 0.87,
        "reasons": ["explicit_link", "same_domain", "semantic_similarity"]
      }
    ]
  }
}

Rules:
- include explicit synergy.links
- include same domain weighted proximity
- include adjacent layer synergy
- include semantic embedding similarity
- avoid self-links
- deduplicate
- sort by weight descending
- keep top-N neighbors per block

---

## 5. mutation_engine.py

Purpose:
Generate NEW derived blocks from existing blocks.

This is not random noise generation.
This is controlled MMSS mutation.

Create:
prompt-db-local/database/system/generated_blocks/

Output block format must be compatible with the existing normalized block schema.

Mutation types:
- param_shift
- phase_shift
- domain_preserving_variation
- detail_amplification
- simplification
- operator_recast

Examples:
- small BPM shift
- frequency offsets
- layer promotion/demotion if valid
- convert G block to Q-style derivative when justified
- enrich dna.params from inherited parents
- preserve ancestry metadata

Every generated block must include:
{
  "id": "...",
  "origin": {
    "mode": "mutation",
    "parents": ["parent_id"],
    "mutation_type": "..."
  }
}

Rules:
- do not mutate blindly
- preserve semantic coherence
- do not invent impossible parameters
- keep mutations small and controlled
- assign lowered confidence if heavily mutated
- include validation flag

Also create:
prompt-db-local/database/system/mutation_report.json

---

## 6. crossover_engine.py

Purpose:
Generate hybrid blocks from TWO compatible parents.

Output directory:
prompt-db-local/database/system/generated_blocks/

Each crossover block must include:
{
  "id": "...",
  "origin": {
    "mode": "crossover",
    "parents": ["parent_a", "parent_b"],
    "strategy": "..."
  }
}

Crossover strategies:
- shared_domain_merge
- adjacent_layer_blend
- params_union
- intent_hybridization
- safe_operator_inheritance

Compatibility rules:
- same or compatible domains
- not conflicting collapse-only + emergence-only unless explicitly safe
- semantic similarity above threshold OR explicit linkage
- avoid nonsense blends

Required behavior:
- merge compatible dna.params
- merge or synthesize synergy.links
- merge intents into concise technical intent
- confidence lower than strongest parent unless clearly stable
- preserve legacy references to both parents in ancestry metadata

Also create:
prompt-db-local/database/system/crossover_report.json

---

## 7. self_rule_engine.py

Purpose:
Generate rules automatically from the database itself.

This replaces only-static rules with data-driven rules.

Output:
prompt-db-local/database/system/self_rules.json

Format:
{
  "version": "3.0",
  "generated_rules": [
    {
      "name": "...",
      "type": "co_occurrence | exclusion | dependency | layer_balance | domain_affinity",
      "weight": 0.0,
      "rule": { ... },
      "evidence": { ... }
    }
  ]
}

Rules must be inferred from:
- graph density
- repeated co-occurrence patterns
- parent-child mutation/crossover stability
- domain/layer correlations
- repeated valid outputs

Examples:
- Rhythm layer1 often pairs with Timbre layer2
- Logic layer3 improves validation in certain intents
- collapse phase blocks should be limited unless explicitly requested
- certain domains strongly co-occur

Also provide:
- validate_selection_with_self_rules(...)
- rank_selection_by_self_rules(...)

---

## 8. memory_v3.py

Purpose:
Persistent adaptive memory with:
- positive memory
- negative memory
- intent-specific memory
- parent-lineage memory for generated blocks

Output:
prompt-db-local/database/system/memory_v3.json

Format:
{
  "block_stats": {
    "block_id": {
      "usage_count": 0,
      "success_score": 0.5,
      "penalty_score": 0.0,
      "novelty_score": 0.5,
      "lineage_score": 0.5
    }
  },
  "intent_stats": {
    "intent_signature": {
      "block_id": 0.5
    }
  },
  "generation_stats": {
    "generated_block_id": {
      "parent_ids": [],
      "stability_score": 0.5
    }
  }
}

Must support:
- load_memory
- save_memory
- update_memory
- get_block_memory_score
- get_intent_memory_boost
- get_lineage_score

---

## 9. builder_v3.py

This is the MAIN GENERATIVE CORE.

Input config example:
{
  "intent": "deep hypnotic industrial techno with spatial diffusion and controlled harmonic collapse",
  "domains": ["Rhythm", "Timbre", "Space", "Logic"],
  "layers": [1, 2, 3],
  "max_blocks": 10,
  "temperature": 0.55,
  "runs": 8,
  "allow_mutation": true,
  "allow_crossover": true,
  "allow_generated_blocks": true,
  "mode": "hybrid"
}

Builder V3 process:

### STEP 1
Load:
- block_index_v3.json
- embeddings.json
- graph_v3.json
- self_rules.json
- memory_v3.json

### STEP 2
Create candidate pool from:
- original blocks
- generated mutation blocks
- generated crossover blocks

### STEP 3
Score each block using:
- priority
- confidence
- embedding similarity to intent
- memory score
- intent-specific boost
- novelty score
- lineage score
- self-rule compatibility

### STEP 4
Selection mode:
- explore
- exploit
- hybrid

### STEP 5
Perform multi-run evolutionary search.

For each run:
- seed candidate subset
- expand through weighted graph
- optionally inject generated blocks
- validate with static rules and self-rules
- compute final run score

### STEP 6
Select best result.

### STEP 7
Update memory.

### STEP 8
Return final assembled result.

Output format:
{
  "meta": {
    "intent": "...",
    "mode": "...",
    "block_count": N,
    "validation": {...},
    "self_rule_score": float,
    "run_score": float
  },
  "blocks": [
    full normalized blocks
  ]
}

Also support command line usage:
python builder_v3.py --intent "..." --domains Rhythm,Timbre,Space,Logic --layers 1,2,3 --max-blocks 10 --temperature 0.55 --runs 8 --mode hybrid --allow-mutation --allow-crossover

---

# PART 2 — TYPESCRIPT / ELECTRON INTEGRATION

Integrate V3 into the existing repository.

You must inspect the existing repository structure and place integration code in the correct locations.

Create or modify the following:

## 10. Electron main process integration

Add a local bridge so the UI can trigger:
- transform
- reindex
- rebuild embeddings
- rebuild graph
- generate mutation blocks
- generate crossover blocks
- regenerate self-rules
- run builder_v3
- return result JSON

Implement this in the Electron main process / preload bridge according to current repository architecture.

Requirements:
- use child_process spawn or equivalent safely
- no blocking UI
- structured JSON result
- capture stdout / stderr
- return execution status to renderer
- use repository-relative paths

---

## 11. TypeScript types

Create or update types for:
- normalized block
- generated block
- builder config
- runtime result
- graph edge
- embedding metadata
- self rule
- runtime job result

Put them in the proper existing types location.

---

## 12. Runtime service wrapper

Create a TS utility/service that calls Electron bridge methods and exposes:
- runTransform()
- runIndexerV3()
- runEmbeddings()
- runGraphV3()
- runMutation()
- runCrossover()
- runSelfRules()
- runBuilderV3(config)

This must fit the existing project style.

---

# PART 3 — REACT UI INTEGRATION

Add a new UI panel for V3.

Name:
MMSS Runtime V3

Requirements:
- fit the existing panel-based application style
- no placeholder component
- fully wired to Electron bridge

UI must include:

### A. Build tools section
Buttons:
- Rebuild Blocks
- Rebuild Index
- Build Embeddings
- Build Graph
- Generate Mutations
- Generate Crossovers
- Generate Self Rules

### B. Builder config section
Inputs:
- intent
- domains multi-select
- layers multi-select
- max_blocks
- temperature
- runs
- mode
- allow_mutation
- allow_crossover
- allow_generated_blocks

### C. Run section
Button:
- Run MMSS V3 Builder

### D. Result section
Display:
- meta
- block list
- validation status
- export-ready JSON preview

### E. Save / export section
Allow saving generated result into the existing export workflow.

---

# PART 4 — EXPORT COMPOSER INTEGRATION

The repository already has export composition logic.

You must integrate V3 result output with the existing export composer flow.

Requirement:
A generated V3 selection must be transformable into final export JSON suitable for the current app export process.

Add support so V3 results can be:
- previewed
- saved as export preset or generated export snapshot
- passed into existing export composer modes where possible

Do not break existing modes:
- as-is
- random-mix
- sequence-based

Add new mode:
- mmss-v3

---

# PART 5 — PERSISTENCE AND META FILES

The repository already stores meta files under `.prompt-db-meta/`.

Integrate or mirror V3 metadata in a coherent way.

You must decide correctly whether each file belongs in:
- prompt-db-local/database/system/
or
- .prompt-db-meta/

Use a consistent strategy and document it.

At minimum persist:
- block_index_v3.json
- embeddings.json
- graph_v3.json
- self_rules.json
- memory_v3.json
- mutation_report.json
- crossover_report.json

---

# PART 6 — SAFETY / VALIDATION

Every generated block must pass structural validation.

Create validation helpers for:
- required fields
- valid domains
- valid layers
- valid op
- ancestry metadata present for generated blocks
- safe confidence ranges
- no malformed JSON
- no invalid graph edges

Builder V3 must never crash when:
- generated blocks folder is empty
- memory file is missing
- graph is partial
- blocks have sparse params
- intent is empty

---

# PART 7 — EXECUTION COMMANDS

Return exact commands to run in the repository.

Must include:

python transform_blocks.py
python indexer_v3.py
python embedding_builder.py
python graph_builder_v3.py
python mutation_engine.py
python crossover_engine.py
python self_rule_engine.py
python builder_v3.py

Also include the npm / Electron commands needed to run the integrated app.

---

# PART 8 — OUTPUT FORMAT

Return:

1. transform_blocks.py
2. indexer_v3.py
3. embedding_builder.py
4. graph_builder_v3.py
5. mutation_engine.py
6. crossover_engine.py
7. self_rule_engine.py
8. memory_v3.py
9. builder_v3.py
10. all TypeScript integration files or patches
11. all React UI files or patches
12. all type definitions
13. all Electron bridge files or patches
14. any export composer changes
15. execution instructions
16. concise explanation of where each file should be placed

Do not omit files.
Do not use pseudo-code.
Do not summarize instead of writing code.

---

# IMPLEMENTATION STYLE REQUIREMENTS

- pure Python or lightweight dependencies only
- TypeScript must match current repository stack
- code must be readable and deterministic
- prefer repository-relative paths
- robust error handling
- do not break existing app flow
- generated blocks must stay schema-compatible with normalized base blocks
- mutation and crossover must be conservative and semantically grounded
- embedding system must be local and deterministic
- self-rules must be evidence-based and derived from actual stored data

---

# FINAL DIRECTIVE

The goal is to turn prompt-db-local into a local MMSS generative workbench.

The system must evolve from:
storage + tags + presets

into:
semantic graph + adaptive memory + mutation + crossover + self-rules + dynamic MMSS generation

Return the complete implementation.
No placeholders.
No skipped files.
No abbreviated code.