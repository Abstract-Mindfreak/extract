# Database Deletion Readiness

Checked on 2026-06-21 from the local Codex shell by connecting directly to PostgreSQL with `psycopg2`.

## Verdict

Do not delete `abstract_mind_db` or `rag_chunks_db` yet.

The merge is only partially verified:

- `abstract_mind_db` still contains legacy MMSS and embedding data that is not present in `abstract-mind-lab`.
- `rag_chunks_db` mostly moved over, but `rag_document_embeddings` still has 11 unique `content_hash` values that do not exist in `abstract-mind-lab`.
- Several `amd_*` placeholder tables already exist in `abstract-mind-lab`, but they are empty, so the documented "preserve with amd_ prefix" plan was not completed in the target database.

## What Is Confirmed As Present

- `amd_tracks` -> `tracks`: 1718 / 1718 rows found by `id,title,created_at`.
- `amd_video_metadata` -> `video_metadata`: all 1718 `track_id` values present.
- `chat_sessions` -> `sessions`: all 210 legacy ids present.
- `songs` -> `tracks`: all 1588 legacy ids present.
- `session_song_links` -> `tracks.session_id`: all 1304 links represented.
- `lyrics_timing_markers` -> `tracks.lyrics_timestamped`: all 368 affected song ids still exist.
- `rag_chunks_db.rag_chunks` -> `rag_chunks`: all 17431 ids present.

## What Is Still Missing

- `amd_app_entity_store` -> `app_entity_store`: 9 legacy `(scope, entity_key)` pairs missing.
- `amd_app_setting_store` -> `app_setting_store`: 5 legacy `(scope, setting_key)` pairs missing.
- `amd_applied_flows` -> `applied_flows`: 54 legacy `(track_id, flow_name, flow_id, version)` tuples missing.
- `amd_applied_memories` -> `applied_memories`: 26 legacy `(track_id, memory_text, memory_id)` tuples missing.
- `amd_rag_document_embeddings` -> `rag_document_embeddings`: all 1462 legacy `content_hash` values missing.
- `rag_chunks_db.rag_document_embeddings` -> `rag_document_embeddings`: 11 unique `content_hash` values missing.
- `amd_mmss_invariants` -> `mmss_invariants`: all 1462 legacy `source_id` values missing.
- `music_blocks` -> `mmss_invariants`: 1462 ids missing; no representation found in `mmss_invariants.source_id`.

## Empty Prefixed Tables In `abstract-mind-lab`

These target tables exist but currently hold `0` rows:

- `amd_app_entity_store`
- `amd_app_setting_store`
- `amd_applied_flows`
- `amd_applied_memories`
- `amd_mmss_invariants`
- `amd_rag_document_embeddings`
- `amd_sessions`
- `amd_tracks`
- `amd_video_metadata`

That matters because the migration notes in this repo claim the conflicting legacy tables were preserved in the merged database under the `amd_` prefix. The data is not there.

## Recommended Next Step

1. Re-run or repair the migration for the missing `amd_*` payloads, especially `amd_mmss_invariants`, `music_blocks`, and `amd_rag_document_embeddings`.
2. Backfill the 11 missing `rag_chunks_db.rag_document_embeddings` rows.
3. Re-check the missing app entity/settings keys and the missing flow/memory tuples.
4. Only delete `abstract_mind_db` and `rag_chunks_db` after `database_merge_verification.json` is clean.
