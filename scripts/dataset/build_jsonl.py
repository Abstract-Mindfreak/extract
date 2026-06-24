"""Write categorized JSONL files for Gemma 4 E2B fine-tuning."""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from extractors import build_all
from scan_inventory import load_config


def strip_meta(example: dict) -> dict:
    return {k: v for k, v in example.items() if not k.startswith("_")}


def write_jsonl(examples: list[dict], path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for ex in examples:
            f.write(json.dumps(strip_meta(ex), ensure_ascii=False) + "\n")
    return len(examples)


def split_train_val(examples: list[dict], train_ratio: float = 0.9) -> tuple[list, list]:
    shuffled = examples[:]
    random.seed(42)
    random.shuffle(shuffled)
    n = int(len(shuffled) * train_ratio)
    return shuffled[:n], shuffled[n:]


def build(project_root: Path | None = None) -> dict[str, Any]:
    root = project_root or Path(__file__).resolve().parents[2]
    cfg = load_config(root)
    by_category = build_all(root, cfg)

    output_base = Path(cfg["output_root"]) / cfg["almost_ready_subdir"]
    staging_base = Path(cfg["staging_root"])
    train_ratio = cfg.get("jsonl", {}).get("train_split", 0.9)

    stats: dict[str, Any] = {"categories": {}, "paths": {}}

    for category, examples in by_category.items():
        if not examples:
            continue
        train, val = split_train_val(examples, train_ratio)

        out_dir = output_base / category
        staging_dir = staging_base / category
        for target_dir, subset, suffix in [
            (out_dir, train, "train"),
            (out_dir, val, "val"),
            (staging_dir, examples, "all"),
        ]:
            path = target_dir / f"mmss_{category}_{suffix}.jsonl"
            count = write_jsonl(subset, path)
            stats["paths"][str(path)] = count

        stats["categories"][category] = {
            "total": len(examples),
            "train": len(train),
            "val": len(val),
        }

    # combined file for Kaggle upload preview
    combined = []
    for examples in by_category.values():
        combined.extend(examples)
    combined_path = staging_base / "mmss_combined_all.jsonl"
    stats["paths"][str(combined_path)] = write_jsonl(combined, combined_path)
    stats["total_examples"] = len(combined)

    manifest_path = staging_base / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    stats["manifest"] = str(manifest_path)
    return stats


if __name__ == "__main__":
    print(json.dumps(build(), ensure_ascii=False, indent=2))
