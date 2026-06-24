#!/usr/bin/env python3
"""Run full MMSS dataset preparation pipeline."""

from __future__ import annotations

import json
import sys
from pathlib import Path

# allow running as script from project root
sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_jsonl import build as build_jsonl
from scan_inventory import load_config, main as scan_main
from validate_jsonl import validate_dir


def run(project_root: Path | None = None) -> dict:
    root = project_root or Path(__file__).resolve().parents[2]
    print("=" * 60)
    print("MMSS Dataset Pipeline")
    print("=" * 60)

    print("\n[1/3] Scanning inventory and detecting duplicates...")
    scan_result = scan_main(str(root))
    print(f"  Total files: {scan_result['summary_data']['total_files']}")
    print(f"  Ready: {scan_result['summary_data']['ready_count']}")
    print(f"  Duplicates: {scan_result['summary_data']['duplicates']}")
    print(f"  Report: {scan_result['summary']}")

    print("\n[2/3] Building JSONL examples (Stage 1-4)...")
    jsonl_stats = build_jsonl(root)
    print(f"  Total examples: {jsonl_stats['total_examples']}")
    for cat, info in jsonl_stats.get("categories", {}).items():
        print(f"  {cat}: {info['total']} (train={info['train']}, val={info['val']})")

    print("\n[3/3] Validating JSONL output...")
    cfg = load_config(root)
    staging = Path(cfg["staging_root"])
    output = Path(cfg["output_root"]) / cfg["almost_ready_subdir"]
    validation = validate_dir(staging) + validate_dir(output)
    valid_count = sum(1 for v in validation if v["valid"])
    print(f"  Files validated: {len(validation)} ({valid_count} OK)")

    result = {
        "scan": scan_result["summary_data"],
        "jsonl": jsonl_stats,
        "validation": validation,
    }

    report_path = Path(cfg["reports_dir"]) / "pipeline_latest.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\nPipeline report: {report_path}")
    print("=" * 60)
    return result


if __name__ == "__main__":
    run()
