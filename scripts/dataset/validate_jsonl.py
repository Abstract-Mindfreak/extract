"""Validate JSONL files against Gemma chat schema."""

from __future__ import annotations

import json
from pathlib import Path


def validate_line(obj: dict, line_no: int) -> list[str]:
    errors = []
    if "messages" not in obj:
        errors.append(f"line {line_no}: missing 'messages'")
        return errors
    msgs = obj["messages"]
    if not isinstance(msgs, list) or len(msgs) < 2:
        errors.append(f"line {line_no}: messages must have at least user+model")
        return errors
    roles = [m.get("role") for m in msgs]
    if "user" not in roles or "model" not in roles:
        errors.append(f"line {line_no}: must include user and model roles")
    for m in msgs:
        if not m.get("content", "").strip():
            errors.append(f"line {line_no}: empty content in role {m.get('role')}")
    return errors


def validate_file(path: Path) -> dict:
    errors = []
    count = 0
    with open(path, encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            count += 1
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                errors.append(f"line {i}: invalid JSON: {e}")
                continue
            errors.extend(validate_line(obj, i))
    return {"file": str(path), "lines": count, "errors": errors, "valid": len(errors) == 0}


def validate_dir(directory: Path) -> list[dict]:
    results = []
    if not directory.exists():
        return results
    for path in sorted(directory.rglob("*.jsonl")):
        results.append(validate_file(path))
    return results


if __name__ == "__main__":
    import sys
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/fine-tuning/staging")
    for r in validate_dir(target):
        status = "OK" if r["valid"] else "FAIL"
        print(f"[{status}] {r['file']} ({r['lines']} lines, {len(r['errors'])} errors)")
