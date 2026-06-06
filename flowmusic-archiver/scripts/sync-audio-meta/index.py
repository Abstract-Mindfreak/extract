from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from lib.m4a_tagger import prepare_tags, should_skip_from_state, validate_tags, write_tags
from lib.scanner import TrackFolder, scan_single_track, scan_track_folders


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synchronize FlowMusic meta.json and image.jpg into audio.m4a tags.")
    parser.add_argument("--account", help="Single account id, e.g. 1")
    parser.add_argument("--accounts", help="Comma-separated account ids, e.g. 1,2,3,4")
    parser.add_argument("--backup", action="store_true", help="Create .bak backup before writing")
    parser.add_argument("--config", default="scripts/sync-audio-meta/config.json", help="Path to config.json")
    parser.add_argument("--dry-run", action="store_true", help="Scan and validate inputs without writing tags")
    parser.add_argument("--limit", type=int, default=None, help="Process only the first N tracks after scan")
    parser.add_argument("--scan", action="store_true", help="Scan only and print summary")
    parser.add_argument("--track-dir", help="Process a single explicit track directory")
    parser.add_argument("--write", action="store_true", help="Write tags into audio.m4a")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[2]
    config_path = (repo_root / args.config).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    base_dir = (repo_root / config["base_dir"]).resolve()
    logs_dir = (repo_root / config["logs_dir"]).resolve()
    state_path = (repo_root / config["resume_state_file"]).resolve()
    logs_dir.mkdir(parents=True, exist_ok=True)
    state = load_state(state_path)
    log_path = logs_dir / f"sync-log-{timestamp_slug()}.jsonl"

    tracks = collect_tracks(args, base_dir, config["accounts"])
    if args.limit is not None:
        tracks = tracks[: args.limit]

    if args.scan or not args.write:
        for index, track in enumerate(tracks, start=1):
            log_event(
                log_path,
                {
                    "account": track.account,
                    "event": "scan",
                    "index": index,
                    "track_dir": str(track.track_dir),
                    "uuid": track.uuid,
                },
            )

        print(f"Scanned {len(tracks)} track folders")
        if not args.write:
            return 0

    write_mode = args.write and not args.dry_run
    results: list[dict[str, Any]] = []

    for index, track in enumerate(tracks, start=1):
        prepared = prepare_tags(
            track,
            default_artist=config["default_artist"],
            description_max_bytes=int(config["description_max_bytes"]),
        )
        state_entry = state.get(track.state_key)

        if should_skip_from_state(state_entry, prepared):
            entry = {
                "account": track.account,
                "event": "skip",
                "index": index,
                "reason": "unchanged-source-signature",
                "track_dir": str(track.track_dir),
                "state_key": track.state_key,
                "uuid": track.uuid,
            }
            log_event(log_path, entry)
            results.append(entry)
            continue

        try:
            if write_mode:
                write_tags(track, prepared, backup=args.backup)
                validation = validate_tags(track, prepared)
                status = "ok" if validation["matches"] and validation["cover_present"] else "validation_failed"
            else:
                validation = {
                    "actual": None,
                    "cover_present": track.image_path.exists(),
                    "matches": True,
                }
                status = "dry_run"

            entry = {
                "account": track.account,
                "artist": prepared.artist,
                "backup": bool(args.backup),
                "event": "process",
                "index": index,
                "mode": "write" if write_mode else "dry-run",
                "rating": prepared.rating,
                "status": status,
                "title": prepared.title,
                "track_dir": str(track.track_dir),
                "uuid": track.uuid,
                "validation": validation,
            }
            state[track.state_key] = {
                "account": track.account,
                "audio_path": str(track.audio_path),
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "source_signature": prepared.source_signature,
                "status": status,
                "uuid": track.uuid,
                "track_dir": str(track.track_dir),
            }
            save_state(state_path, state)
            log_event(log_path, entry)
            results.append(entry)
            print(f"[{index}/{len(tracks)}] {status}: {track.track_dir.name}")
        except Exception as exc:  # noqa: BLE001
            entry = {
                "account": track.account,
                "error": repr(exc),
                "event": "error",
                "index": index,
                "mode": "write" if write_mode else "dry-run",
                "track_dir": str(track.track_dir),
                "uuid": track.uuid,
            }
            state[track.state_key] = {
                "account": track.account,
                "audio_path": str(track.audio_path),
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "source_signature": prepared.source_signature,
                "status": "error",
                "uuid": track.uuid,
                "track_dir": str(track.track_dir),
            }
            save_state(state_path, state)
            log_event(log_path, entry)
            results.append(entry)
            print(f"[{index}/{len(tracks)}] error: {track.track_dir.name} -> {exc}")

    summary = summarize_results(results)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def collect_tracks(args: argparse.Namespace, base_dir: Path, account_map: dict[str, str]) -> list[TrackFolder]:
    if args.track_dir:
        return [scan_single_track(Path(args.track_dir).resolve())]

    if args.account:
        account_ids = [args.account.strip()]
    elif args.accounts:
        account_ids = [item.strip() for item in args.accounts.split(",") if item.strip()]
    else:
        account_ids = sorted(account_map.keys(), key=int)

    return scan_track_folders(base_dir, account_map, account_ids)


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    raw_state = json.loads(path.read_text(encoding="utf-8"))
    migrated_state: dict[str, Any] = {}

    for key, value in raw_state.items():
        if isinstance(value, dict) and value.get("track_dir") and ":" not in key:
            migrated_state[f"{value.get('account', 'custom')}:{Path(value['track_dir']).as_posix().lower()}"] = value
        else:
            migrated_state[key] = value

    return migrated_state


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(path)


def log_event(log_path: Path, payload: dict[str, Any]) -> None:
    payload = {
      **payload,
      "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def summarize_results(results: list[dict[str, Any]]) -> dict[str, Any]:
    summary = {
        "dry_run": 0,
        "error": 0,
        "ok": 0,
        "skip": 0,
        "validation_failed": 0,
    }

    for result in results:
        event = result.get("event")
        status = result.get("status")

        if event == "skip":
            summary["skip"] += 1
        elif event == "error":
            summary["error"] += 1
        elif status in summary:
            summary[status] += 1

    summary["total"] = len(results)
    return summary


def timestamp_slug() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


if __name__ == "__main__":
    raise SystemExit(main())
