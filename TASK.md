{
  "project": "Abstract Mindfreak Extract",
  "goal": "Rollback to the stable state before \"Да. Приступи к фазе 2\", restore ASE Console, then reorient the system toward high-signal MMSS invariant extraction, selective vectorization, and RAG preparation for local Ollama.",
  "normalized_task_for_devin": {
    "phase_1_rollback": [
      "Find the commit immediately before the user response \"Да. Приступи к фазе 2\".",
      "Rollback the codebase to that stable point.",
      "Verify that ASE Console is restored and functional.",
      "Create a commit with a clear rollback message.",
      "Push the rollback commit to the remote repository."
    ],
    "phase_2_data_architecture": [
      "Create a PostgreSQL schema in database `abstract-mind-lab` for MMSS knowledge storage.",
      "Add a table for invariant storage, a table for generation/search traces, and a table for embeddings if needed.",
      "Store only structured, high-value MMSS rules, logic principles, meta-formulas, and instructions.",
      "Add deduplication, metadata search, and vector search indexes.",
      "Keep the schema idempotent and safe to rerun."
    ],
    "phase_3_invariant_extraction": [
      "Extract universal MMSS invariants from the current codebase instead of vectorizing everything.",
      "Prioritize these paths: ASE variation components, core MMSS components, services, scripts, seeds, logs, and invariant extractor modules.",
      "Classify extracted content into categories such as logic, MMSS principle, rule, meta_formula, instruction, and template.",
      "Normalize extracted data into a unified JSON structure for later storage and retrieval.",
      "Focus on abstract reusable structure, not raw volume."
    ],
    "phase_4_rag_preparation": [
      "Vectorize only the curated invariant set.",
      "Integrate the local Ollama model as the reasoning layer that receives only the most important invariant context.",
      "Build a RAG flow that searches vectors, composes compact context, and sends it to the local LLM.",
      "Store generation outputs, search chains, and important vector queries in the database.",
      "Use the system to teach the LLM MMSS logic, principles, and how to extend them with new structures."
    ],
    "phase_5_validation": [
      "Add tests for invariant extraction, vectorization, retrieval, and Ollama integration.",
      "Validate that ASE Console is restored.",
      "Validate that extracted invariants are correctly stored and retrievable.",
      "Validate that the RAG pipeline uses only high-signal context."
    ]
  },
  "recommended_focus": [
    "Do not vectorize everything.",
    "Curate only strong MMSS blocks, rules, logic patterns, and meta-structures.",
    "Use the local LLM as a high-precision consumer of selected invariants.",
    "Treat logs, generation traces, and search chains as first-class knowledge artifacts."
  ],
  "priority_sources_from_extract": [
    "react/my-app/src/components/ase-variations/aase-monitor-update.jsx",
    "react/my-app/src/components/ase-variations/ai-orchestrator-panel.jsx",
    "react/my-app/src/components/ase-variations/ase_monitor_supreme.jsx",
    "react/my-app/src/components/ase-variations/ase-v4_infinity.jsx",
    "react/my-app/src/components/ase-variations/decomposition-audio.jsx",
    "react/my-app/src/components/ase-variations/entropy_modulator.jsx",
    "react/my-app/src/components/ase-variations/flowmusic-agent-panel.jsx",
    "react/my-app/src/components/ase-variations/generation-engine-panel.jsx",
    "react/my-app/src/components/ase-variations/mmss-mutator-panel.jsx",
    "react/my-app/src/components/ase-variations/modulator_rack.jsx",
    "react/my-app/src/components/JsonBlockEditor.jsx",
    "react/my-app/src/components/JsonSequenceBuilder.jsx",
    "react/my-app/src/components/PromptIdeWorkspace.jsx",
    "react/my-app/src/components/SequenceWorkspacePanels.jsx",
    "react/my-app/src/mmss/promptLibrary.js",
    "react/my-app/src/mmss/reducer.js",
    "react/my-app/src/mmss/useAudioEngine.js",
    "react/my-app/src/services/MMSSMutatorRuntimeService.js",
    "react/my-app/src/services/PythonGenerationLayer.js",
    "react/my-app/src/types/Track.ts",
    "react-agent/flowmusic_agent_models.py",
    "react-agent/models.py",
    "extract_agent/server.py",
    "scripts/apply_indexes.py",
    "scripts/import_archiver.py",
    "import_producer_blocks.py",
    "database/connection.py",
    "database/seeds/mmss_ontology_seed.json",
    "docs/mmss/mmss_progress_log.json",
    "invariants_extractor/"
  ],
  "database_plan": {
    "tables": [
      {
        "name": "mmss_invariants",
        "purpose": "Curated MMSS rules, logic, principles, templates, and meta-formulas.",
        "recommended_fields": [
          "id",
          "source_path",
          "category",
          "title",
          "content",
          "normalized_json",
          "content_hash",
          "metadata",
          "created_at",
          "updated_at",
          "vectorized"
        ]
      },
      {
        "name": "generation_results",
        "purpose": "Outputs from generations, search chains, important prompts, and retrieval traces.",
        "recommended_fields": [
          "id",
          "query",
          "context_used",
          "result_text",
          "search_chain",
          "metadata",
          "created_at"
        ]
      },
      {
        "name": "vector_embeddings",
        "purpose": "Embedding vectors linked to curated invariant records.",
        "recommended_fields": [
          "id",
          "invariant_id",
          "embedding",
          "model_name",
          "dimensions",
          "created_at"
        ]
      }
    ],
    "indexing": [
      "Unique or hash-based deduplication on content_hash.",
      "GIN index for metadata search.",
      "Category index for filtering.",
      "Vector index for nearest-neighbor retrieval."
    ]
  },
  "ollama_rag_note": {
    "answer": "Yes — local Ollama can play the role of a reasoning model in this architecture, but it should receive curated invariant context rather than raw bulk data.",
    "supporting_context": [
      "Ollama embeddings are designed to produce vector representations for semantic search and retrieval.", [ollama](https://ollama.com/blog/embedding-models)
      "PostgreSQL with pgvector can store and search embeddings directly in the database.", [cloud.google](https://cloud.google.com/discover/what-is-pgvector)
      "LangChain's Ollama embeddings integration supports local embedding workflows with a configured Ollama instance." [reference.langchain](https://reference.langchain.com/python/langchain-ollama/embeddings/OllamaEmbeddings)
    ]
  },
  "implementation_strategy": [
    "Rollback first.",
    "Restore ASE Console.",
    "Create the MMSS invariant schema.",
    "Write the invariant extractor.",
    "Curate and vectorize only high-signal blocks.",
    "Wire retrieval into local Ollama.",
    "Log every important generation and retrieval chain."
  ],
  "suggested_devin_instruction": "Please execute Phase 1 first: restore the stable commit before \"Да. Приступи к фазе 2\", verify ASE Console, create a rollback commit, and push it. Then prepare Phase 2 and Phase 3 around selective MMSS invariant extraction rather than full-bulk vectorization."
}


**Небольшие рекомендации для улучшения:**

Можно добавить секцию с критериями приемки (acceptance criteria), чтобы Devin точно знал, когда задача выполнена:

```json
"acceptance_criteria": [
  "ASE Console is restored and accessible",
  "Database schema created with all three tables",
  "At least 80% of priority files processed for invariant extraction",
  "Vector embeddings generated for extracted invariants",
  "RAG pipeline successfully retrieves context for Ollama",
  "Generation results are logged to database",
  "All changes committed and pushed to repository"
]
```


