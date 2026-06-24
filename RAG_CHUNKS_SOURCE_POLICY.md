# RAG Chunks Source Policy

Checked and updated on 2026-06-22.

## Goal

`rag_chunks` should store one practical retrieval layer per semantic object, not every derivative copy of the same track/session across legacy and merged databases.

## Canonical Sources To Keep

- `abstract-mind-lab.tracks`
  - canonical track record
  - should carry full prompt/request/response context via `raw_data`, plus `conditions`, `lyrics_timestamped`, `session_id`
- `abstract-mind-lab.mmss_collection`
  - curated MMSS fragments, distinct from raw track/session records
- `abstract-mind-lab.mmss_filtered`
  - structured analytical layer
- `abstract-mind-lab.mmss_custom_instructions`
- `abstract-mind-lab.mmss_albums`
- `abstract-mind-lab.mmss_domain_patterns`
- `abstract_mind_db.music_blocks`
  - legacy-only source not present canonically in the merged DB

## Sources Removed Or Blocked

- `applied_flows`
- `applied_memories`
- `chat_sessions`
- `app_entity_store`
- `app_setting_store`
- `mmss_invariants`
- `mmss_tracks_prompts`
  - duplicates `tracks.prompt`
- `sessions`
  - session context is too broad and duplicates track-generation content already embedded in `tracks.raw_data`
- `abstract_mind_db.tracks`
  - duplicates `abstract-mind-lab.tracks`
- `abstract_mind_db.mmss_domain_patterns`
  - duplicates `abstract-mind-lab.mmss_domain_patterns`

## Confirmed Duplicate Mechanism

For track `5c293123-4a7e-43cc-ae16-8583eced8694`:

- raw source exists in `abstract-mind-lab.tracks`
- the same `source_id` also existed in `rag_chunks` from `abstract_mind_db.tracks`
- `mmss_tracks_prompts` contained the same prompt again for the same `track_id`

That means the old `rag_chunks` layer mixed:

1. canonical track rows
2. legacy track copies
3. prompt-only derivative rows

This produced duplication even before MMSS derived layers were considered.

## Current Status After Cleanup

- `tracks`: `1718` rows, `0` duplicate `source_id`
- sample track `5c293123-4a7e-43cc-ae16-8583eced8694` now appears once in `rag_chunks`
- track chunk payload now contains:
  - `prompt`
  - `conditions`
  - `lyrics_timestamped`
  - `raw_data`

## Code Paths

### Refresh path

1. `POST /api/rag-chunks/refresh`
2. [archiver-server.js](D:/WORK/CLIENTS/extract/react/my-app/archiver-server.js:131)
3. spawns [chunks-cleaner.py](D:/WORK/CLIENTS/extract/react/react_agent/chunks-cleaner.py:1)
4. script rebuilds `public.rag_chunks`

### Track lineage analysis

- [analyze-rag-track-lineage.js](D:/WORK/CLIENTS/extract/react/my-app/scripts/analyze-rag-track-lineage.js:1)
- output: [rag_track_lineage.json](D:/WORK/CLIENTS/extract/rag_track_lineage.json:1)

### Cleanup / backfill utilities

- [prune-rag-chunks.js](D:/WORK/CLIENTS/extract/react/my-app/scripts/prune-rag-chunks.js:1)
- [backfill-rag-track-payloads.js](D:/WORK/CLIENTS/extract/react/my-app/scripts/backfill-rag-track-payloads.js:1)
