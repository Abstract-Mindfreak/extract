# FlowMusic.app Archiver — Technical Reference

> Last updated: 2026-02-20  
> Covers: `scripts/producer_playwright_archiver.mjs`

---

## Architecture Overview

The archiver is a standalone Node.js script using **Playwright** to automate a real Chromium browser. All API calls are executed via `page.evaluate(fetch(...))` inside the browser tab, which:

1. Bypasses Cloudflare bot detection (headless requests are blocked)
2. Automatically includes first-party cookies and CORS origin
3. Allows Bearer token auth alongside cookie auth

```
┌──────────────────────────────────────────┐
│  Node.js Process                         │
│   ┌─────────────┐    ┌────────────────┐  │
│   │ Playwright  │──▶ │ Chromium Tab   │  │
│   │ Controller  │    │ (flowmusic.app)  │  │
│   └──────┬──────┘    │                │  │
│          │           │ page.evaluate( │  │
│          │           │   fetch(API)   │──────▶ FlowMusic.app API
│          │           │ )              │  │
│   ┌──────▼──────┐    └────────────────┘  │
│   │ File I/O    │                        │
│   │ (downloads) │                        │
│   └─────────────┘                        │
└──────────────────────────────────────────┘
```

---

## Authentication Flow

FlowMusic.app uses **Supabase Auth** with chunked cookies.

### Cookie Structure
Session tokens are split across multiple cookies. Cookie names vary by account:
- `sb-api-auth-token.0` / `sb-api-auth-token.1` — standard pattern
- `sb-sb-auth-token.0` / `sb-sb-auth-token.1` — alternative pattern (some accounts)
- Domain: `www.flowmusic.app`

> **Note**: Cookie prefix varies. The archiver matches any cookie matching `sb-*auth-token.N` pattern.

### Token Extraction
```
Cookie value: "base64-eyJhY2Nlc3NfdG9rZW4iOi..."
                      ↓ atob(value.substring(7))
Decoded JSON: { "access_token": "eyJhbGci...", "refresh_token": "...", ... }
```

The `access_token` is a JWT Bearer token used in `Authorization: Bearer <token>` headers.

### Auth Strategy (3-stage retry)
1. **Cookie auth** — `credentials: 'include'` sends cookies automatically
2. **Bearer token** — extracted from chunked cookies, sent in `Authorization` header
3. **Wait + reload + re-extract** — waits 5s, reloads the page, extracts a fresh token

> **Critical**: All `fetch()` calls inside `page.evaluate()` MUST include `credentials: 'include'`. Without this, the browser won't send session cookies, causing 401 errors even when logged in.

### Session Persistence
- Saved to `producer_auth.json` via Playwright's `context.storageState()`
- Contains cookies + localStorage for `www.flowmusic.app`
- **Sensitive**: never commit this file

---

## API Endpoints

### Track Listing (Harvest)
```
GET /__api/clips/auth-user?limit=100&offset={n}&filter=generations&include_disliked=false
Authorization: Bearer <access_token>
```

**Note:** Endpoint changed from `/__api/auth-user/tracks` to `/__api/clips/auth-user` with `filter=generations` parameter.
Returns an array of track objects. Paginate by incrementing `offset` by `limit` until an empty array is returned.

### Generation Metadata
```
POST /__api/v2/generations
Content-Type: application/json
Body: { "riff_ids": ["id1", "id2", ...] }
```
Returns detailed generation data including seeds, conditions, and timestamped lyrics. Batch up to ~50 IDs per request.

### CDN URLs (Direct Download)
Audio and images are served from Google Cloud Storage:
```
Audio: https://storage.googleapis.com/corpusant-app-public/riffs/{author_id}/audio/{song_id}.m4a
Image: https://storage.googleapis.com/corpusant-app-public/riffs/{author_id}/image/{song_id}.jpg
```
These URLs are public and don't require authentication.

---

## Download Formats

### Currently Implemented
| Format | Method | Notes |
|--------|--------|-------|
| **M4A** | Direct CDN URL from `audio_url` field | Fast, no extra API call needed |
| **JPG** | Direct CDN URL from `image_url` field | Cover art |
| **JSON** | Generated from manifest data | Full metadata including raw API response |

### Investigated but NOT Implemented
| Format | Method | Why Not |
|--------|--------|---------|
| **WAV** | Requires clicking Download → WAV in the UI, or calling an authenticated `/download` endpoint | Significantly slower for 8000+ songs; requires per-song API call |
| **MP3** | Same as WAV — UI click or authenticated API call | Same performance concern |
| **Stems** | UI click → Stems option | Separate generation, not always available |
| **Video** | Requires triggering video generation first | Separate process; videos don't pre-exist |

### Key Finding: No Static CDN URLs for WAV/MP3
The M4A URL pattern (`/audio/{id}.m4a`) does NOT work with `.wav` or `.mp3` extensions. These formats require the client to trigger a server-side conversion/export via an authenticated API endpoint. The frontend JavaScript bundles contain references to `format=wav` and `downloadAudio` endpoints, but using these would add ~2-5s per song.

---

## Manifest & State Files

### `producer_manifest.json`
- Contains all discovered tracks with metadata
- **Streamed** to disk (item-by-item) to avoid `RangeError: Invalid string length` on large manifests (8000+ items)
- Written atomically (temp file + rename) to prevent corruption from concurrent access

### `completion.json`
- Set of completed song IDs (already downloaded)
- Used for resume capability — skip already-downloaded songs on re-run
- Also written atomically

### `verification_summary.json`
- Generated after download completes
- Contains counts: `manifest_items`, `completed_items`, `expected_audio`, `downloaded_audio`, `missing_audio`

---

## Known Issues & Solutions

### 1. JSON Corruption on Concurrent Writes
**Problem**: Multiple async download workers calling `persistCompletion()` simultaneously caused partial/interleaved JSON writes.  
**Solution**: Atomic writes — write to a temp file with a random suffix, then `fs.rename()` to the target path. Rename is atomic on Linux/macOS.

### 2. RangeError: Invalid string length
**Problem**: `JSON.stringify()` on 8000+ items with full `raw_data` exceeds V8's max string length.  
**Solution**: Stream JSON to disk using `createWriteStream`, writing each item individually.

### 3. Stale Duplicate Folders
**Problem**: When a song's title changes between manifest runs, a new folder is created with the new title, leaving the old folder orphaned (no `audio.m4a`).  
**Example**: `Item_xxxx` and `Untitled_xxxx` folders for the same song ID.  
**Impact**: ~146 stale folders in a typical 8000-song library.

### 4. Songs with No Audio (HTTP 404)
**Problem**: ~322 songs in the manifest have `audio_url: null`.  
**Cause**: Songs that failed to generate, were still processing, or had their audio purged by FlowMusic.app.  
**Verification**: CDN HEAD requests for these IDs return HTTP 404 — the audio genuinely doesn't exist.

### 5. Session Expiry During Long Runs
**Problem**: Bearer tokens expire during multi-hour archival runs.  
**Current**: Script detects 401/403 and exits with instructions to re-run with `--headful`.  
**Future**: Could implement token refresh using the Supabase refresh_token from the cookie.

---

## Output Structure

```
producer_backup/
├── 00/                          # Hex prefix bucket (first 2 chars of UUID)
│   └── 00632f86-.../            # {song_id}_{safe_title}
│       ├── audio.m4a            # Audio file
│       ├── image.jpg            # Cover art
│       └── meta.json            # All metadata
├── 01/
│   └── ...
├── ...
├── ff/
├── producer_manifest.json       # Full manifest (streamed JSON)
├── completion.json              # Resume state
├── network_capture.json         # Raw API responses (from earlier runs)
└── verification_summary.json    # Post-run verification
```

Per-song `meta.json` includes:
- `id`, `title`, `created_at`, `source_url`
- `audio_url`, `video_url`, `image_url`
- `sound` — the full generation prompt/tags
- `lyrics` — plain text with section headers (`[Verse 1]`, `[Chorus]`, etc.)
- `lyrics_timestamped` — word-level timestamps (if available from API; often `null`)
- `duration` — track length in seconds
- `model_version`, `seed`, `play_count`, `favorite_count`
- `parent_id` — parent song ID for remixes/covers
- `transform_type` — e.g. "remix", "cover", "vocal_swap"
- `conditions` — full generation conditions/prompts with timing and strength
- `raw_data` — complete API response object (escape hatch for undocumented fields)

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `playwright` | Browser automation, Cloudflare bypass |
| `p-queue` | Concurrency-limited download queue |
| `p-retry` | Retry with exponential backoff for flaky downloads |
