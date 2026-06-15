# FlowMusic.app Archiver

FlowMusic archiver with an MMSS-oriented v2 pipeline. It harvests track metadata, captures linked conversation sessions, builds relation lineage, downloads local media files, and can persist normalized MMSS records into PostgreSQL.

## Prerequisites

- Node.js 18+
- A FlowMusic account with an accessible library
- PostgreSQL only if you want `DB_MODE=v2` persistence

## Installation

```bash
npm install
npx playwright install chromium
```

## Environment

The archiver reads `.env` from the workspace root and `flowmusic-archiver/.env` if present.

Typical database config:

```bash
DB_MODE=v2
FLOWMUSIC_DB_ENABLED=true
FLOWMUSIC_DB_AUTO_INIT=true
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=abstract-mind-lab
PG_USER=mind_user
PG_PASSWORD=...
```

Optional post-processing:

```bash
FLOWMUSIC_EMBED_METADATA=true
FLOWMUSIC_EMBED_ACCOUNTS=1,2,3,4
```

## Usage

First login / refresh:

```bash
node archiver.mjs --headful
```

Resume with saved session:

```bash
node archiver.mjs
```

Reuse the saved manifest and skip re-harvest:

```bash
node archiver.mjs --skip-harvest
```

## Pipeline

The v2 flow is:

1. Harvest all track metadata into `producer_manifest.json`
2. Capture linked conversation/session payloads into `sessions/`
3. Build `mmss_manifest.json` with lineage, session context, and normalized MMSS structure
4. Download track assets and optionally embed local metadata tags
5. Persist MMSS records into PostgreSQL when enabled

## Output

```text
flowmusic_backup/
|- 00/
|  `- <track-id>_<safe-title>/
|     |- audio.m4a
|     |- image.jpg
|     `- meta.json
|- sessions/
|- producer_manifest.json
|- mmss_manifest.json
|- completion.json
|- verification_summary.json
`- session_capture_summary.json
```

Additional artifacts:

- `schema.sql` contains the MMSS PostgreSQL schema
- `test/mmss-mapper.test.mjs` covers the mapper and lineage helpers
- `scripts/sync-audio-meta/` contains the optional Python metadata embedder

## PostgreSQL

When `DB_MODE=v2` and `FLOWMUSIC_DB_ENABLED=true`, the archiver writes:

- `sessions`
- `tracks`
- `stems`
- `applied_flows`
- `applied_memories`
- `video_metadata`
- `internal_tags`

The schema is auto-created from `schema.sql` unless `FLOWMUSIC_DB_AUTO_INIT=false`.

## Known Limitations

- lineage is inferred from available parent/session links, so some chains may remain partial
- `audio_md5` is computed after local download, not before remote fetch
- metadata embedding depends on the Python helper and its local dependencies
- some FlowMusic assets may still return `404` or `403` if they no longer exist upstream

## Security

- auth JSON files contain live session cookies and must never be committed
- backup folders, local DB artifacts, and embedder state/logs are ignored in git
- verify `.gitignore` before pushing account-specific output
