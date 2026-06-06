# Audio Metadata Synchronizer

Python CLI for embedding `meta.json` + `image.jpg` into `audio.m4a` tags inside the FlowMusic archive.

## What It Writes

- `©nam` from `title`
- `©ART` from `artist`, or fallback `FlowMusic`
- `covr` from `image.jpg`
- `©cmt` from `description`, or fallback `raw_data.operation.sound_prompt`
- `rtng` from `rating`, mapped from `0..5` to `0..100`

The tool also stores a custom source signature tag:

- `----:com.flowmusic.archiver:source_signature`

This is used together with `state.json` for resume and unchanged-source skipping.

## Install

```bash
python -m pip install mutagen
```

## Usage

Dry run / scan:

```bash
python scripts/sync-audio-meta/index.py --scan --accounts=1,2,3,4
python scripts/sync-audio-meta/index.py --account=1 --dry-run
```

Write mode:

```bash
python scripts/sync-audio-meta/index.py --write --backup --accounts=1,2,3,4
```

Single folder PoC:

```bash
python scripts/sync-audio-meta/index.py --write --backup --track-dir "flowmusic_backup_4\\1a\\1a43d62f-0da4-444c-87c2-4ce21c4cb418_OMEGA ZERO_ Recursive Collapse (v2 Logic)"
```

## Files

- `config.json` contains account-path mapping and state/log locations
- `state.json` stores resume information
- `logs/sync-log-*.jsonl` stores one JSON record per operation

## Notes

- Processing is sequential on purpose.
- If `artist` is missing in `meta.json`, fallback is `FlowMusic`.
- If `description` is missing, fallback is `raw_data.operation.sound_prompt`.
- Description is stripped and truncated to `1024` UTF-8 bytes.
- A `.bak` file is created only if `--backup` is passed and no backup exists yet.
- Resume state is keyed by `account + track path`, not only by `uuid`, so duplicate UUIDs across backups do not collide.
- Unchanged-source detection uses a hash of `meta.json` + `image.jpg`, so metadata is rewritten only when the real source files changed.
