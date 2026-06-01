from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List


ROOT_DIR = Path(__file__).resolve().parents[1]
MIRROR_PATH = ROOT_DIR / "shared" / "react-prompt-library.json"


def load_react_prompt_library(path: Path | None = None) -> Dict[str, Any]:
    target = path or MIRROR_PATH
    if not target.exists():
        return {"promptLibrary": {"blocks": [], "sequences": []}, "updatedAt": None}
    with target.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def iter_react_prompt_blocks(path: Path | None = None) -> Iterable[Dict[str, Any]]:
    payload = load_react_prompt_library(path)
    prompt_library = payload.get("promptLibrary") or {}
    for block in prompt_library.get("blocks") or []:
        yield block


def get_react_prompt_block_payloads(path: Path | None = None) -> List[Dict[str, Any]]:
    payloads: List[Dict[str, Any]] = []
    for block in iter_react_prompt_blocks(path):
        payload = ((block.get("payload") or {}).get("data")) or {}
        payloads.append(payload)
    return payloads


if __name__ == "__main__":
    snapshot = load_react_prompt_library()
    prompt_library = snapshot.get("promptLibrary") or {}
    blocks = prompt_library.get("blocks") or []
    sequences = prompt_library.get("sequences") or []
    print(
        json.dumps(
            {
                "updatedAt": snapshot.get("updatedAt"),
                "blockCount": len(blocks),
                "sequenceCount": len(sequences),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
