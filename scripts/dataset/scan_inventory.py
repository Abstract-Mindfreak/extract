"""Scan source roots, detect duplicates, produce inventory and readiness report."""

from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml


@dataclass
class FileRecord:
    path: str
    rel_path: str
    source_label: str
    size: int
    ext: str
    sha256: str
    category_hint: str = ""
    valid_json: bool | None = None
    valid_md: bool | None = None
    duplicate_of: str | None = None
    readiness: str = "pending"


def load_config(project_root: Path, config_name: str = "config.yaml") -> dict:
    with open(project_root / "scripts/dataset" / config_name, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    for root in cfg["source_roots"]:
        p = Path(root["path"])
        if not p.is_absolute():
            root["path"] = str((project_root / p).resolve())
        else:
            root["path"] = str(p.resolve())
    cfg["project_root"] = str(project_root.resolve())
    out = Path(cfg["output_root"])
    cfg["output_root"] = str(out.resolve())
    cfg["staging_root"] = str((project_root / cfg["staging_root"]).resolve())
    cfg["reports_dir"] = str((project_root / cfg["reports_dir"]).resolve())
    return cfg


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def should_skip(path: Path, skip_dirs: list[str]) -> bool:
    parts = {p.lower() for p in path.parts}
    for skip in skip_dirs:
        if skip.lower() in parts or skip.replace("/", "\\").lower() in str(path).lower():
            return True
    return False


def classify_hint(rel: str, ext: str, keywords: dict[str, list[str]]) -> str:
    text = rel.lower()
    scores = {cat: 0 for cat in keywords}
    for cat, kws in keywords.items():
        for kw in kws:
            if kw in text:
                scores[cat] += 1
    if ext == ".json" and "blocks" in text:
        scores["categories"] += 2
    if ext == ".json" and "MMSS" in text:
        scores["mmss"] += 2    
    if ext == ".py" and "mmss_core" in text:
        scores["mmss-universal"] += 2
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "mmss-universal"


def validate_file(path: Path, ext: str) -> tuple[bool | None, bool | None]:
    valid_json = None
    valid_md = None
    try:
        if ext == ".json":
            with open(path, encoding="utf-8") as f:
                json.load(f)
            valid_json = True
        elif ext == ".md":
            content = path.read_text(encoding="utf-8", errors="replace")
            valid_md = len(content.strip()) > 0
    except (json.JSONDecodeError, OSError):
        if ext == ".json":
            valid_json = False
        elif ext == ".md":
            valid_md = False
    return valid_json, valid_md


def readiness_score(rec: FileRecord, cfg: dict) -> str:
    processing = cfg.get("processing", {})
    disable_file_size_deduplication = processing.get("disable_file_size_deduplication", False)
    disable_length_limits = processing.get("disable_length_limits", False)
    max_file_size = processing.get("max_file_size_bytes", 15_000_000)
    min_file_size = processing.get("min_file_size_bytes", 1)
    
    if not disable_file_size_deduplication and rec.duplicate_of:
        return "duplicate"
    if rec.ext == ".json" and rec.valid_json is False:
        return "invalid"
    if rec.size < min_file_size:
        return "too_small"
    if not disable_length_limits and max_file_size > 0 and rec.size > max_file_size:
        return "too_large_review"
    if rec.valid_json is True or rec.valid_md is True or rec.ext in {".py", ".txt", ".yaml", ".yml"}:
        return "ready"
    return "review"


def scan(cfg: dict) -> list[FileRecord]:
    extensions = set(cfg["extensions"]["text"])
    skip_dirs = cfg["extensions"]["skip_dirs"]
    keywords = cfg["classification_keywords"]
    records: list[FileRecord] = []

    for root_cfg in sorted(cfg["source_roots"], key=lambda r: r["priority"]):
        root = Path(root_cfg["path"])
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if should_skip(path, skip_dirs):
                continue
            ext = path.suffix.lower()
            if ext not in extensions:
                continue
            try:
                rel = str(path.relative_to(root))
            except ValueError:
                rel = path.name
            valid_json, valid_md = validate_file(path, ext)
            digest = sha256_file(path)
            rec = FileRecord(
                path=str(path),
                rel_path=rel,
                source_label=root_cfg["label"],
                size=path.stat().st_size,
                ext=ext,
                sha256=digest,
                category_hint=classify_hint(rel, ext, keywords),
                valid_json=valid_json,
                valid_md=valid_md,
            )
            records.append(rec)

    processing = cfg.get("processing", {})
    disable_content_deduplication = processing.get("disable_content_deduplication", False)
    disable_file_size_deduplication = processing.get("disable_file_size_deduplication", False)
    
    by_hash: dict[str, list[FileRecord]] = defaultdict(list)
    by_name_size: dict[tuple[str, int], list[FileRecord]] = defaultdict(list)
    for rec in records:
        by_hash[rec.sha256].append(rec)
        by_name_size[(Path(rec.rel_path).name.lower(), rec.size)].append(rec)

    # exact content duplicates
    if not disable_content_deduplication:
        for group in by_hash.values():
            if len(group) < 2:
                continue
            primary = sorted(group, key=lambda r: (r.source_label != "mmss-builder", r.path))[0]
            for rec in group:
                if rec.path != primary.path:
                    rec.duplicate_of = primary.path

    # same name + size from different roots (likely duplicate, flag for review)
    if not disable_file_size_deduplication:
        for group in by_name_size.values():
            if len(group) < 2:
                continue
            labels = {r.source_label for r in group}
            if len(labels) > 1:
                primary = sorted(group, key=lambda r: (r.source_label != "mmss-builder", r.path))[0]
                hashes = {r.sha256 for r in group}
                if len(hashes) == 1:
                    primary = sorted(group, key=lambda r: r.source_label)[0]
                    for rec in group:
                        if rec.path != primary.path and not rec.duplicate_of:
                            rec.duplicate_of = primary.path

    for rec in records:
        rec.readiness = readiness_score(rec, cfg)
    return records


def write_reports(cfg: dict, records: list[FileRecord]) -> dict[str, Any]:
    reports_dir = Path(cfg["reports_dir"])
    reports_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    inventory_path = reports_dir / f"inventory_{ts}.json"
    csv_path = reports_dir / f"readiness_{ts}.csv"
    summary_path = reports_dir / f"summary_{ts}.json"

    summary: dict[str, Any] = {
        "generated_at": ts,
        "total_files": len(records),
        "by_source": {},
        "by_category_hint": {},
        "by_readiness": {},
        "by_ext": {},
        "duplicates": 0,
        "ready_count": 0,
    }
    for rec in records:
        summary["by_source"][rec.source_label] = summary["by_source"].get(rec.source_label, 0) + 1
        summary["by_category_hint"][rec.category_hint] = summary["by_category_hint"].get(rec.category_hint, 0) + 1
        summary["by_readiness"][rec.readiness] = summary["by_readiness"].get(rec.readiness, 0) + 1
        summary["by_ext"][rec.ext] = summary["by_ext"].get(rec.ext, 0) + 1
        if rec.duplicate_of:
            summary["duplicates"] += 1
        if rec.readiness == "ready":
            summary["ready_count"] += 1

    with open(inventory_path, "w", encoding="utf-8") as f:
        json.dump([asdict(r) for r in records], f, ensure_ascii=False, indent=2)

    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(asdict(records[0]).keys()) if records else [])
        if records:
            writer.writeheader()
            for rec in records:
                writer.writerow(asdict(rec))

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # also write latest symlinks as fixed names
    for src, name in [(inventory_path, "inventory_latest.json"), (csv_path, "readiness_latest.csv"), (summary_path, "summary_latest.json")]:
        latest = reports_dir / name
        if latest.exists():
            latest.unlink()
        latest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")

    return {
        "inventory": str(inventory_path),
        "csv": str(csv_path),
        "summary": str(summary_path),
        "summary_data": summary,
    }


def main(project_root: str | None = None, config_name: str = "config.yaml") -> dict:
    root = Path(project_root or Path(__file__).resolve().parents[2])
    cfg = load_config(root, config_name)
    records = scan(cfg)
    return write_reports(cfg, records)


if __name__ == "__main__":
    result = main()
    print(json.dumps(result["summary_data"], ensure_ascii=False, indent=2))
