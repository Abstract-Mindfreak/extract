# AGENTS.md

## Project Overview

Producer.ai Archiver — a standalone Node.js script that uses Playwright to back up an entire Producer.ai music library. Downloads M4A audio, cover art (JPG), and full metadata (JSON) for every song.

Single file: `archiver.mjs` (~700 lines). No framework, no build step.

## Tech Stack

- **Runtime**: Node.js 18+
- **Browser automation**: Playwright (Chromium)
- **Concurrency**: p-queue (default 8 workers)
- **Retry**: p-retry with exponential backoff

## Build & Run

```bash
npm install
npx playwright install chromium
node archiver.mjs --headful    # first run (login required)
node archiver.mjs              # subsequent runs
node archiver.mjs --skip-harvest  # resume downloads only
```

No build step. The script runs directly with Node.js.

## Architecture

All API calls happen inside `page.evaluate(fetch(...))` in the browser context. This is required because:
1. Cloudflare blocks headless/direct HTTP requests
2. Cookies must be sent with `credentials: 'include'`
3. The Bearer token is a JWT extracted from Supabase chunked cookies (`sb-api-auth-token.0`, `.1`)

Key classes:
- `ProducerArchiver` — main class with `get()`, `post()`, `harvestMetadata()`, `downloadAll()`
- `persistManifest()` — streams JSON item-by-item via `createWriteStream` (avoids V8 string limit on 8000+ items)
- `persistCompletion()` — atomic write (temp file + rename) for crash safety

## Code Style

- ES modules (`import`/`export`), no CommonJS
- No TypeScript, no transpilation — plain `.mjs`
- Async/await throughout, no callbacks
- Console logging for progress (no logging framework)
- Guard clauses over nested conditionals

## Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/__api/auth-user/tracks?limit=100&offset=N&filter=my-songs` | GET | Paginated track listing |
| `/__api/v2/generations` | POST | Batch generation metadata (seeds, conditions, lyrics) |
| GCS CDN `storage.googleapis.com/corpusant-app-public/riffs/...` | GET | Direct audio/image download (no auth needed) |

## Known Gotchas

1. **All `fetch()` in `page.evaluate()` MUST use `credentials: 'include'`** — without this, cookies aren't sent and you get 401s even when logged in
2. **Manifest JSON can exceed V8 string limits** — must stream to disk, never `JSON.stringify` the full manifest
3. **Concurrent writes corrupt JSON files** — always use atomic writes (write to `.tmp`, then `fs.rename`)
4. **~300 songs may have no audio** — these genuinely don't exist on Producer.ai's CDN (failed generations)
5. **Sessions expire** — Bearer tokens last a few hours; re-run with `--headful` to refresh

## Security

- `producer_auth.json` contains session cookies — **never commit to git**
- The `.gitignore` excludes it, but verify before pushing
- No API keys or secrets are hardcoded in the script

## Testing

No automated test suite. Manual verification:
- Check `verification_summary.json` after a run for expected vs actual counts
- Spot-check a few `meta.json` files for completeness
- Verify audio files play correctly
