from __future__ import annotations

import json
import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    project_root = Path(__file__).resolve().parents[3]
    backend_root = project_root / "invariants_extractor" / "backend"
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))


def main() -> int:
    _bootstrap_import_path()

    from agents.offline_agent import OfflineAgent  # noqa: WPS433
    from core.omega_engine import OmegaEngine  # noqa: WPS433

    payload = json.load(sys.stdin)
    items = payload.get("items") or []

    agent = OfflineAgent()
    engine = OmegaEngine()
    results = []

    for item in items:
      text = str(item.get("text") or "").strip()
      if not text:
        continue

      domain = str(item.get("domain") or "generic").strip() or "generic"
      sequence = agent.analyze(content=text, domain=domain)
      result = engine.run(sequence)
      results.append(
          {
              "id": item.get("id"),
              "domain": domain,
              "result": result.model_dump(mode="json"),
          }
      )

    sys.stdout.buffer.write(json.dumps({"results": results}, ensure_ascii=True).encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
