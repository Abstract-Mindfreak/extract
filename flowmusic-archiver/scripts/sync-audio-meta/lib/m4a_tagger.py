from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from mutagen.mp4 import MP4, MP4Cover

from .scanner import TrackFolder


@dataclass(slots=True)
class PreparedTags:
    artist: str
    comment: str | None
    cover_format: int
    cover_path: Path
    rating: int | None
    source_signature: str
    title: str


def prepare_tags(track: TrackFolder, default_artist: str, description_max_bytes: int) -> PreparedTags:
    meta = json.loads(track.meta_path.read_text(encoding="utf-8"))
    title = first_string(
        meta.get("title"),
        nested_get(meta, "raw_data.title"),
        nested_get(meta, "raw_data.operation.title"),
        folder_title_fallback(track.folder_name),
    )
    artist = first_string(
        meta.get("artist"),
        nested_get(meta, "raw_data.artist"),
        nested_get(meta, "raw_data.author_name"),
        default_artist,
    )
    comment = first_string(
        meta.get("description"),
        nested_get(meta, "raw_data.operation.sound_prompt"),
        nested_get(meta, "sound.prompt"),
        None,
    )
    comment = sanitize_description(comment, description_max_bytes) if comment else None
    rating = normalize_rating(meta.get("rating"))
    cover_format = cover_format_from_path(track.image_path)
    source_signature = build_source_signature(track)

    return PreparedTags(
        artist=artist,
        comment=comment,
        cover_format=cover_format,
        cover_path=track.image_path,
        rating=rating,
        source_signature=source_signature,
        title=title,
    )


def write_tags(track: TrackFolder, prepared: PreparedTags, backup: bool) -> None:
    if backup:
        backup_path = track.audio_path.with_suffix(track.audio_path.suffix + ".bak")
        if not backup_path.exists():
            shutil.copy2(track.audio_path, backup_path)

    audio = MP4(track.audio_path)

    if audio.tags is None:
        audio.add_tags()

    audio.tags["\xa9nam"] = [prepared.title]
    audio.tags["\xa9ART"] = [prepared.artist]

    if prepared.comment:
        audio.tags["\xa9cmt"] = [prepared.comment]
    elif "\xa9cmt" in audio.tags:
        del audio.tags["\xa9cmt"]

    if prepared.rating is not None:
        audio.tags["rtng"] = [prepared.rating]
    elif "rtng" in audio.tags:
        del audio.tags["rtng"]

    cover_bytes = prepared.cover_path.read_bytes()
    audio.tags["covr"] = [MP4Cover(cover_bytes, imageformat=prepared.cover_format)]
    audio.tags["----:com.flowmusic.archiver:source_signature"] = [prepared.source_signature.encode("utf-8")]
    audio.save()


def validate_tags(track: TrackFolder, prepared: PreparedTags) -> dict[str, Any]:
    audio = MP4(track.audio_path)
    tags = audio.tags or {}
    actual_title = first_list_item(tags.get("\xa9nam"))
    actual_artist = first_list_item(tags.get("\xa9ART"))
    actual_comment = first_list_item(tags.get("\xa9cmt"))
    actual_rating = first_list_item(tags.get("rtng"))
    actual_signature = first_bytes_item(tags.get("----:com.flowmusic.archiver:source_signature"))
    cover_entries = tags.get("covr") or []

    return {
        "cover_present": bool(cover_entries),
        "matches": (
            actual_title == prepared.title
            and actual_artist == prepared.artist
            and actual_comment == prepared.comment
            and actual_signature == prepared.source_signature
            and normalize_rating(actual_rating) == prepared.rating
        ),
        "actual": {
            "artist": actual_artist,
            "comment": actual_comment,
            "rating": normalize_rating(actual_rating),
            "source_signature": actual_signature,
            "title": actual_title,
        },
    }


def should_skip_from_state(state_entry: dict[str, Any] | None, prepared: PreparedTags) -> bool:
    return bool(
        state_entry
        and state_entry.get("status") == "ok"
        and state_entry.get("source_signature") == prepared.source_signature
    )


def build_source_signature(track: TrackFolder) -> str:
    digest = hashlib.sha1()
    digest.update(track.meta_path.read_bytes())
    digest.update(b"\n--flowmusic-meta-boundary--\n")
    digest.update(track.image_path.read_bytes())
    return digest.hexdigest()


def cover_format_from_path(path: Path) -> int:
    if path.suffix.lower() in {".jpg", ".jpeg"}:
        return MP4Cover.FORMAT_JPEG
    return MP4Cover.FORMAT_PNG


def nested_get(source: dict[str, Any], path: str) -> Any:
    current: Any = source
    for key in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def first_string(*values: Any) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def folder_title_fallback(folder_name: str) -> str:
    if "_" not in folder_name:
        return folder_name
    return folder_name.split("_", 1)[1].strip()


def sanitize_description(value: str, max_bytes: int) -> str:
    text = re.sub(r"[#*_`>]+", " ", value)
    text = re.sub(r"\s+", " ", text).strip()
    encoded = text.encode("utf-8")

    if len(encoded) <= max_bytes:
        return text

    truncated = encoded[:max_bytes]
    while True:
        try:
            return truncated.decode("utf-8").rstrip()
        except UnicodeDecodeError:
            truncated = truncated[:-1]


def normalize_rating(value: Any) -> int | None:
    if value is None:
        return None

    try:
        rating = float(value)
    except (TypeError, ValueError):
        return None

    rating = max(0.0, min(5.0, rating))
    return int(round((rating / 5.0) * 100))


def first_list_item(value: Any) -> Any:
    if isinstance(value, list) and value:
        return value[0]
    return None


def first_bytes_item(value: Any) -> str | None:
    item = first_list_item(value)
    if isinstance(item, bytes):
        return item.decode("utf-8", errors="replace")
    return None
