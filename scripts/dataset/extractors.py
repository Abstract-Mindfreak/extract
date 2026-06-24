"""Extract JSONL training examples from MMSS-builder sources."""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path
from typing import Any, Iterator

from extractors_stage4 import (
    deduplicate_examples,
    extract_from_architectures,
    extract_from_helper_json,
    extract_from_meta_yaml,
    extract_from_raw_dataset,
    extract_from_ready_for_dataset,
    extract_from_source_archive,
)
from schema import (
    GLOBAL_SYSTEM_PROMPT_RU,
    block_explain_model,
    block_explain_user,
    engine_doc_model,
    engine_doc_user,
    formula_explain_model,
    formula_explain_user,
    make_example,
)

SUBSYSTEM_MAP = {
    "fractal_reassembly": "PFR",
    "temporal_navigator": "FRP",
    "context_weaver": "A-MMSS",
    "prompt_generator": "MMSS-Prompt",
    "domains": "MMSS-Domains",
    "orchestrator_core": "MMSS-Orchestrator",
    "mmss_activator": "MMSS-System",
}


def _walk_formulas(obj: Any, subsystem: str, prefix: str = "") -> Iterator[dict]:
    if isinstance(obj, dict):
        if "formula" in obj and "name" in obj:
            yield {
                "id": prefix or obj.get("id", "unknown"),
                "name": obj["name"],
                "formula": obj["formula"],
                "description": obj.get("description", ""),
                "subsystem": subsystem,
            }
        for k, v in obj.items():
            yield from _walk_formulas(v, subsystem, prefix=k if not prefix else f"{prefix}.{k}")
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            yield from _walk_formulas(item, subsystem, prefix=f"{prefix}[{i}]")


def extract_from_packages(packages_dir: Path, max_items: int = 500) -> list[dict]:
    examples = []
    if not packages_dir.exists():
        return examples
    for path in sorted(packages_dir.glob("*.json")):
        subsystem = "PFR" if "fractal" in path.name else "FRP" if "frp" in path.name else "A-MMSS" if "ammss" in path.name or "context" in path.name else "MMSS"
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        for formula in _walk_formulas(data, subsystem):
            fid = str(formula["id"])[:80]
            name = str(formula.get("name", fid))[:120]
            user = formula_explain_user(fid, name, formula["formula"], formula["description"], formula["subsystem"])
            model = formula_explain_model(fid, name, formula["formula"], formula["description"], formula["subsystem"])
            examples.append({
                **make_example(GLOBAL_SYSTEM_PROMPT_RU, user, model),
                "_meta": {"source": str(path), "type": "formula_explain", "category": "mmss-universal"},
            })
        # operators with action/description
        if isinstance(data, dict):
            for top_key, top_val in data.items():
                if not isinstance(top_val, dict):
                    continue
                for section_name in ("FRACTAL_REASSEMBLY_OPERATORS", "TEMPORAL_OPERATORS", "CONTEXT_OPERATORS", "OPERATORS"):
                    ops = top_val.get(section_name, {})
                    if not isinstance(ops, dict):
                        continue
                    for op_id, op_data in ops.items():
                        if not isinstance(op_data, dict):
                            continue
                        desc = op_data.get("description") or op_data.get("action") or op_data.get("name", "")
                        formula = op_data.get("formula") or op_data.get("symbol", "")
                        if not desc and not formula:
                            continue
                        user = formula_explain_user(op_id, op_data.get("name", op_id), formula, desc, subsystem)
                        model = formula_explain_model(op_id, op_data.get("name", op_id), formula, desc, subsystem)
                        examples.append({
                            **make_example(GLOBAL_SYSTEM_PROMPT_RU, user, model),
                            "_meta": {"source": str(path), "type": "operator_explain", "category": "mmss-universal"},
                        })
                        if len(examples) >= max_items:
                            return examples
            if len(examples) >= max_items:
                return examples
    return examples


def extract_from_blocks(blocks_dir: Path, max_items: int = 300) -> list[dict]:
    examples = []
    if not blocks_dir.exists():
        return examples
    for path in sorted(blocks_dir.rglob("*.json")):
        try:
            block = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        domain = block.get("attr", {}).get("domain", "")
        category = "mmss-sound-craft" if domain in ("Timbre", "Rhythm") else "categories"
        user = block_explain_user(block)
        model = block_explain_model(block)
        examples.append({
            **make_example(GLOBAL_SYSTEM_PROMPT_RU, user, model),
            "_meta": {"source": str(path), "type": "block_explain", "category": category},
        })
        if len(examples) >= max_items:
            return examples
    return examples


def extract_from_engines(engine_paths: list[Path]) -> list[dict]:
    examples = []
    for path in engine_paths:
        if not path.exists():
            continue
        source = path.read_text(encoding="utf-8", errors="replace")
        docstring = ast.get_docstring(ast.parse(source)) or ""
        classes = re.findall(r"^class (\w+)", source, re.MULTILINE)
        subsystem = SUBSYSTEM_MAP.get(path.stem, "MMSS")
        user = engine_doc_user(path.name, docstring, classes)
        model = engine_doc_model(path.name, docstring, classes, subsystem)
        examples.append({
            **make_example(GLOBAL_SYSTEM_PROMPT_RU, user, model),
            "_meta": {"source": str(path), "type": "engine_doc", "category": "mmss-universal"},
        })
    return examples


def extract_from_stored_prompts(prompts_dir: Path, max_items: int = 340) -> list[dict]:
    examples = []
    if not prompts_dir.exists():
        return examples
    for path in sorted(prompts_dir.glob("*.json")):
        if path.name.startswith(".") or "database" in str(path):
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        mmss = data.get("mmss_structure")
        if not mmss:
            continue
        tags = data.get("metadata", {}).get("tags", [])
        category = "mmss-sound-craft" if any(t in tags for t in ("producer-ai", "audio", "ase")) else "mmss-universal"
        name = data.get("metadata", {}).get("name", "unknown")
        user = (
            f"Задача: опиши MMSS-структуру промпта и её ops.\n\n"
            f"Имя: {name}\n```json\n{json.dumps(mmss, ensure_ascii=False, indent=2)[:4000]}\n```\n"
            f"Верни JSON: status, pkg, ver, ops_count, primary_domain, summary"
        )
        ops = mmss.get("ops", [])
        model = json.dumps({
            "status": "ok",
            "pkg": mmss.get("pkg"),
            "ver": mmss.get("ver"),
            "ops_count": len(ops),
            "primary_domain": ops[0].get("domain") if ops else None,
            "summary": f"MMSS-пакет {name} с {len(ops)} операциями",
        }, ensure_ascii=False, indent=2)
        examples.append({
            **make_example(GLOBAL_SYSTEM_PROMPT_RU, user, model),
            "_meta": {"source": str(path), "type": "stored_prompt", "category": category},
        })
        if len(examples) >= max_items:
            return examples
    return examples


def extract_from_domains(domains_path: Path) -> list[dict]:
    examples = []
    if not domains_path.exists():
        return examples
    import importlib.util
    spec = importlib.util.spec_from_file_location("mmss_domains", domains_path)
    if not spec or not spec.loader:
        return examples
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception:
        return examples
    d_f_map = getattr(mod, "DOMAIN_D_F_OPTIMAL", {})
    for domain, d_f in d_f_map.items():
        user = (
            f"Задача: укажи оптимальную фрактальную размерность D_f для домена MMSS.\n\n"
            f"Домен: {domain}\n"
            f"Верни JSON: status, domain, D_f_optimal, rationale"
        )
        model = json.dumps({
            "status": "ok",
            "domain": domain,
            "D_f_optimal": d_f,
            "rationale": f"Для домена «{domain}» оптимальная D_f = {d_f} (MMSS DOMAIN_D_F_OPTIMAL).",
        }, ensure_ascii=False, indent=2)
        examples.append({
            **make_example(GLOBAL_SYSTEM_PROMPT_RU, user, model),
            "_meta": {"source": str(domains_path), "type": "domain_d_f", "category": "categories"},
        })
    return examples


def build_all(project_root: Path, cfg: dict) -> dict[str, list[dict]]:
    mb = cfg.get("mmss_builder_paths", {})
    s4 = cfg.get("stage4", {})
    root = project_root
    all_examples: list[dict] = []

    # Stage 1-3 sources
    all_examples.extend(extract_from_packages(root / mb.get("packages", "packages")))
    all_examples.extend(extract_from_blocks(root / mb.get("blocks", "data/prompts/database/blocks")))
    engine_paths = [root / p for p in mb.get("engines", [])]
    all_examples.extend(extract_from_engines(engine_paths))
    all_examples.extend(extract_from_stored_prompts(root / mb.get("stored_prompts", "data/prompts")))
    all_examples.extend(extract_from_domains(root / "mmss_core" / "domains.py"))

    # Stage 4 sources
    all_examples.extend(extract_from_meta_yaml(
        root / s4.get("meta_yaml", "packages/mmss_meta_core_v6.yaml"),
        max_ops=s4.get("max_yaml_ops", 512),
    ))
    all_examples.extend(extract_from_architectures(
        root / mb.get("architectures", "architectures"),
        max_items=s4.get("max_architecture", 100),
    ))
    raw_path = Path(s4.get("raw_dataset", ""))
    if not raw_path.is_absolute():
        raw_path = root / raw_path
    all_examples.extend(extract_from_raw_dataset(raw_path, max_docs=s4.get("max_raw_docs", 400)))

    helper_path = Path(s4.get("helper_json", ""))
    if helper_path and not helper_path.is_absolute():
        helper_path = root / helper_path
    if helper_path.exists():
        all_examples.extend(extract_from_helper_json(helper_path, max_items=s4.get("max_helper_items", 300)))

    archive_path = root / s4.get("source_archive", "mmss_core/ai/source_files_done")
    all_examples.extend(extract_from_source_archive(archive_path, max_files=s4.get("max_archive_files", 80)))

    ready_path = Path(s4.get("ready_for_dataset", ""))
    if ready_path.exists():
        all_examples.extend(extract_from_ready_for_dataset(ready_path, max_items=100))

    all_examples = deduplicate_examples(all_examples)

    by_category: dict[str, list[dict]] = {
        "mmss-universal": [],
        "mmss-sound-craft": [],
        "categories": [],
    }
    for ex in all_examples:
        cat = ex.get("_meta", {}).get("category", "mmss-universal")
        by_category.setdefault(cat, []).append(ex)
    return by_category
