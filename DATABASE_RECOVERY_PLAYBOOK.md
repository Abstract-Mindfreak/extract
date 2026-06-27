# Database Recovery

Основной recovery теперь сводится к одному шагу:

```powershell
node react/my-app/scripts/restore-abstract-mind-lab.js
```

Что делает скрипт:

- пересоздает runtime/MMSS/GraphRAG схемы в `abstract-mind-lab`
- копирует основные legacy-таблицы из `abstract_mind_db`
- восстанавливает чистые `rag_chunks` из `exported_data/rag_chunks.json`
- восстанавливает `mmss_collection`, `mmss_albums`, `mmss_custom_instructions` из `exported_data/rag_document_embeddings.json`
- пересобирает `mmss_tracks_prompts`
- пересобирает `mmss_filtered` и curated-часть `mmss_collection`
- исправляет `rag_document_embeddings`, создавая правильный `vector`-schema вместо ошибочного `jsonb`

Опциональные режимы:

```powershell
node react/my-app/scripts/restore-abstract-mind-lab.js --import-legacy-embeddings
node react/my-app/scripts/restore-abstract-mind-lab.js --rebuild-embeddings
node react/my-app/scripts/restore-abstract-mind-lab.js --seed-mmss
```

- `--import-legacy-embeddings`: заливает старые эмбеддинги из `rag_chunks_db`
- `--rebuild-embeddings`: заново векторизует данные через локальный Ollama
- `--seed-mmss`: добавляет неисторические baseline seeds для `mmss_generation_results`, `mmss_skills`, `mmss_skill_sets`, `mmss_skill_trees`

Ограничение:

- точные исторические данные для `mmss_generation_results`, `mmss_skills`, `mmss_skill_sets`, `mmss_skill_trees`, `mmss_skill_runs` не полностью восстанавливаются из текущих экспортов; без отдельного полного бэкапа для них доступен только seed/baseline путь
