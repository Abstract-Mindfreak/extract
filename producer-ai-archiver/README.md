# FlowMusic.app Archiver

Emergency backup tool for FlowMusic.app — downloads your **entire music library** including M4A audio, cover art, and all metadata (lyrics, prompts, generation settings, seeds, etc.).

Built with Playwright for browser automation. Resumes on crash and skips already-downloaded songs.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ installed
- A FlowMusic.app account with songs in your library

## Installation

```bash
# Install dependencies
npm install

# Install the Chromium browser binary (required, one-time)
npx playwright install chromium
```

## Usage

### First Run (Login Required)

```bash
node archiver.mjs --headful
```

1. A Chromium browser window will open and navigate to FlowMusic.app
2. **Log in** with your account in the browser window
3. Once you see your song library, open a **separate terminal** and run:
   ```bash
   touch producer_login_ready
   ```
4. The script will save your session and begin archiving

### Subsequent Runs

```bash
node archiver.mjs
```

Uses the saved session from `producer_auth.json`. If the session has expired, it will tell you to re-run with `--headful`.

### Resume / Skip Harvest

```bash
node archiver.mjs --skip-harvest
```

Skips re-scanning your library and goes straight to downloading any missing files from the existing manifest. Useful when resuming after a crash.

## What Gets Downloaded

Each song gets its own folder inside `producer_backup/`:

```
producer_backup/
├── 00/
│   └── 00632f86-..._Song Title/
│       ├── audio.m4a        # Audio file
│       ├── image.jpg        # Cover art
│       └── meta.json        # All metadata
├── 01/
│   └── ...
└── ff/
```

### Metadata includes:
- **Title**, creation date, duration, source URL
- **Lyrics** (plain text with section headers)
- **Sound/Prompt** — the full generation prompt and tags
- **Generation data** — model version, seed, conditions, transform type
- **Stats** — play count, favorite count
- **Parent song ID** — for remixes, covers, and vocal swaps
- **Raw API data** — complete API response as an escape hatch

## Resumability

The script is fully resumable:
- `producer_manifest.json` — tracks all discovered songs
- `completion.json` — tracks which songs have been fully downloaded
- If the script crashes or you stop it, just run it again — it picks up where it left off

## Session Security

- `producer_auth.json` contains your login session cookies
- **Never share** this file or commit it to Git
- To force a fresh login, delete it and re-run with `--headful`

## Known Limitations

- **M4A only** — WAV/MP3 downloads require per-song API calls which would significantly slow down large archives
- Some songs may return HTTP 404 if they failed to generate or were purged by FlowMusic.app
- Sessions expire after a few hours; re-run with `--headful` to refresh

## Technical Details

See [TECHNICAL_REFERENCE.md](./TECHNICAL_REFERENCE.md) for in-depth documentation on the architecture, authentication flow, API endpoints, and known issues.

---

Made with ❤️ for preserving your AI music creations
