from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(slots=True)
class TrackFolder:
    account: str
    audio_path: Path
    folder_name: str
    image_path: Path
    meta_path: Path
    state_key: str
    track_dir: Path
    uuid: str


def scan_track_folders(base_dir: Path, account_map: dict[str, str], account_ids: Iterable[str]) -> list[TrackFolder]:
    track_folders: list[TrackFolder] = []

    for account_id in account_ids:
        account_folder_name = account_map.get(account_id)

        if not account_folder_name:
          continue

        account_root = base_dir / account_folder_name

        if not account_root.exists():
            continue

        for meta_path in account_root.rglob("meta.json"):
            track_dir = meta_path.parent
            audio_path = track_dir / "audio.m4a"
            image_path = track_dir / "image.jpg"

            if not audio_path.exists():
                continue

            if not image_path.exists():
                continue

            uuid = infer_uuid(track_dir.name)
            track_folders.append(
                TrackFolder(
                    account=account_id,
                    audio_path=audio_path,
                    folder_name=track_dir.name,
                    image_path=image_path,
                    meta_path=meta_path,
                    state_key=build_state_key(account_id, track_dir),
                    track_dir=track_dir,
                    uuid=uuid,
                )
            )

    track_folders.sort(key=lambda item: (item.account, str(item.track_dir).lower()))
    return track_folders


def scan_single_track(track_dir: Path, account: str = "custom") -> TrackFolder:
    meta_path = track_dir / "meta.json"
    image_path = track_dir / "image.jpg"
    audio_path = track_dir / "audio.m4a"

    if not meta_path.exists():
        raise FileNotFoundError(f"meta.json missing in {track_dir}")

    if not image_path.exists():
        raise FileNotFoundError(f"image.jpg missing in {track_dir}")

    if not audio_path.exists():
        raise FileNotFoundError(f"audio.m4a missing in {track_dir}")

    return TrackFolder(
        account=account,
        audio_path=audio_path,
        folder_name=track_dir.name,
        image_path=image_path,
        meta_path=meta_path,
        state_key=build_state_key(account, track_dir),
        track_dir=track_dir,
        uuid=infer_uuid(track_dir.name),
    )


def infer_uuid(folder_name: str) -> str:
    return folder_name.split("_", 1)[0]


def build_state_key(account: str, track_dir: Path) -> str:
    return f"{account}:{track_dir.as_posix().lower()}"
