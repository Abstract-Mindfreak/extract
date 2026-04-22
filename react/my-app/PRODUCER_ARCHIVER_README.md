# FlowMusic.app Archiver Integration

Multi-account archiver for FlowMusic.app integrated into ASE Master Console.

## Features

- **4 Account Management** — Manage 4 separate FlowMusic.app accounts (different Google logins)
- **Browser Automation** — Uses Playwright for reliable Cloudflare bypass
- **Full Metadata** — Downloads M4A audio, JPG covers, MP4 videos, JSON metadata
- **Real-time Logs** — Monitor archiver progress in UI
- **Session Persistence** — Each account has separate auth state
- **Resume Support** — Continue interrupted downloads

## Installation

Archiver is already cloned and dependencies installed:
```
d:\WORK\CLIENTS\extract\flowmusic-archiver\
```

Dependencies:
- Node.js 18+
- Playwright (with Chromium)
- p-queue

## Quick Start

### 1. Start the Archiver API Server

In a separate terminal, run:
```bash
cd d:\WORK\CLIENTS\extract\react\my-app
npm install  # First time only
npm run archiver:server
```

You should see:
```
FlowMusic.app Archiver API Server
HTTP API: http://localhost:3456
WebSocket: ws://localhost:3456
```

Keep this terminal open! The server must be running for the UI to work.

### 2. Start React App

In another terminal:
```bash
cd d:\WORK\CLIENTS\extract\react\my-app
npm start
```

### 3. Open Archiver Panel

In the browser, open **ASE Master Console** and select **"FlowMusic.app Archiver"** from the variation switcher.

## First Time Setup

### 1. Configure Accounts

Open **FlowMusic.app Archiver** panel in ASE Master Console.

Each account has:
- Unique color indicator (Red, Blue, Green, Purple)
- Separate auth state file
- Separate output directory
- Editable name (click to rename)

### 2. Authenticate Each Account

For each of your 4 accounts:

1. Click **"LOGIN & AUTHENTICATE"**
2. Browser window opens automatically
3. Log in to FlowMusic.app with your Google account
4. Wait until you see your song library
5. Click **"LOGIN READY"** button in UI
6. Browser closes and session is saved

### 3. Run Archiver

After authentication:

- **START** — Full harvest + download all songs
- **RESUME** — Skip metadata harvest, download only missing files
- **STOP** — Cancel current operation
- **FOLDER** — Open output directory in Explorer

## Output Structure

Each account has separate folder:
```
flowmusic-archiver/
├── flowmusic_backup_1/     # Account 1 songs
│   ├── ab/
│   │   └── abc123_Song Title/
│   │       ├── audio.m4a
│   │       ├── image.jpg
│   │       ├── video.mp4
│   │       └── meta.json
├── flowmusic_backup_2/     # Account 2 songs
├── flowmusic_backup_3/     # Account 3 songs
└── flowmusic_backup_4/     # Account 4 songs
```

## Metadata Included

Each song's `meta.json` contains:
- `title` — Song title
- `audio_url` — Download URL
- `image_url` — Cover art URL
- `video_url` — Video URL (if exists)
- `lyrics` — Full lyrics
- `lyrics_timestamped` — Word-by-word timestamps
- `conditions` — Generation prompts/settings
- `seed` — Generation seed
- `model_version` — AI model used
- `play_count`, `favorite_count` — Stats
- `parent_id`, `transform_type` — If remixed
- `raw_data` — Complete API response

## Global Settings

- **Concurrency** — Number of parallel downloads (1-16)
- Default: 4 concurrent downloads

## Troubleshooting

### Session Expired
If you see "Session expired" error:
1. Click **"CLEAR AUTH"** for that account
2. Re-run **"LOGIN & AUTHENTICATE"**

### Browser Not Opening
Check Windows Defender/antivirus isn't blocking Node.js from launching browsers.

### Download Stuck
1. Click **STOP**
2. Click **RESUME** to continue from where it left off

### Wrong Google Account
If browser opens with wrong Google account:
1. Close browser window
2. Clear browser cookies manually
3. Re-run authentication

## Architecture

### Browser → Node.js Bridge

Since React runs in the browser and cannot access Node.js modules (child_process, fs, etc.), we use a bridge architecture:

```
┌─────────────────┐      HTTP/WebSocket       ┌─────────────────┐
│   React App     │  ←────────────────────→   │  archiver-server│
│   (Browser)     │      localhost:3456        │   (Node.js)     │
└─────────────────┘                            └─────────────────┘
        │                                               │
        │                                               │
        ▼                                               ▼
ASEMasterConsole                              flowmusic-archiver
                                                      │
                                                      ▼
                                               Playwright Browser
```

### API Server (archiver-server.js)

Express server that:
- Exposes REST API for account management
- WebSocket for real-time log streaming
- Spawns archiver.mjs processes
- Manages 4 account profiles

### React Service (ProducerArchiverService.js)

Browser-compatible service that:
- Communicates via fetch() and WebSocket
- No Node.js dependencies
- Falls back gracefully if server offline

## Technical Details

### Auth System
- Uses Supabase Auth (sb-api-auth-token cookies)
- Session stored in `producer_auth_{N}.json`
- Bearer token extracted automatically
- Cookie-based auth with Cloudflare clearance

### API Endpoints
- `/__api/auth-user/tracks` — Song library
- `/__api/v2/generations` — Generation details

### Resume Capability
- `producer_manifest.json` — All songs metadata
- `completion.json` — Downloaded song IDs
- Atomic file writes prevent corruption

## Environment Variables

Can be set in `.env` or system:
- `PRODUCER_BASE_URL` — Default: https://www.flowmusic.app
- `PRODUCER_CONCURRENCY` — Default: 8
- `PRODUCER_AUTH_STATE` — Auth file path
- `PRODUCER_OUTPUT_DIR` — Output directory

## Files Added

```
react/my-app/src/
├── services/
│   └── ProducerArchiverService.js    # Multi-account manager
└── components/ase-variations/
    └── producer-archiver-panel.jsx     # UI panel
```

## License

Same as flowmusic-archiver (presumably MIT)
