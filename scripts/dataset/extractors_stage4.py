"""Stage 4 extractors: raw-dataset, architectures, meta yaml, source archive, helper JSON."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, Iterator

import yaml

from schema import (
    GLOBAL_SYSTEM_PROMPT_RU,
    formula_explain_model,
    formula_explain_user,
    make_example,
)

SOUND_KEYWORDS = (
    "flowmusic", "producer", "audio", "sound", "lfe", "lyric", "ase",
    "timbre", "rhythm", "track", "eq", "gate", "phoneme", "music",
)
ARCHIVE_PRIORITY = (
    "libformulas", "operators-mmss", "frp-generation", "template-mmss",
    "export-protocol", "meta-fractal", "formulas-database", "producer-ai",
    "pfr", "ammss", "contextweaver",
)


def _category_for_path(path: Path, content: str = "") -> str:
    text = f"{path.name} {path.as_posix()} {content[:500]}".lower()
    if any(k in text for k in SOUND_KEYWORDS):
        return "mmss-sound-craft"
    if any(k in text for k in ("logic", "space", "domain", "category", "layer")):
        return "categories"
    return "mmss-universal"


def _example(user: str, model: str, source: str, ex_type: str, category: str) -> dict:
    return {
        **make_example(GLOBAL_SYSTEM_PROMPT_RU, user, model),
        "_meta": {"source": source, "type": ex_type, "category": category},
    }


def _walk_formula_nodes(obj: Any, prefix: str = "", subsystem: str = "MMSS") -> Iterator[dict]:
    if isinstance(obj, dict):
        formula = obj.get("formula") or obj.get("f")
        if formula and isinstance(formula, str) and len(formula) > 3:
            name = obj.get("id") or obj.get("i") or obj.get("name") or prefix or "formula"
            desc = obj.get("description") or obj.get("error_guard") or obj.get("domain") or ""
            yield {
                "id": str(name)[:80],
                "name": str(name)[:120],
                "formula": formula[:500],
                "description": str(desc)[:500],
                "subsystem": subsystem,
            }
        for k, v in obj.items():
            if k in ("formula", "f", "description", "error_guard", "domain"):
                continue
            yield from _walk_formula_nodes(v, prefix=k if not prefix else f"{prefix}.{k}", subsystem=subsystem)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            yield from _walk_formula_nodes(item, prefix=f"{prefix}[{i}]", subsystem=subsystem)


def _formula_examples_from_obj(
    obj: Any,
    source: str,
    subsystem: str,
    ex_type: str,
    category: str,
    limit: int,
    seen: set[str],
    out: list[dict],
) -> None:
    for item in _walk_formula_nodes(obj, subsystem=subsystem):
        key = hashlib.sha256(f"{item['id']}|{item['formula']}".encode()).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        user = formula_explain_user(
            item["id"], item["name"], item["formula"], item["description"], item["subsystem"]
        )
        model = formula_explain_model(
            item["id"], item["name"], item["formula"], item["description"], item["subsystem"]
        )
        out.append(_example(user, model, source, ex_type, category))
        if len(out) >= limit:
            return


def extract_from_meta_yaml(yaml_path: Path, max_ops: int = 512) -> list[dict]:
    examples: list[dict] = []
    seen: set[str] = set()
    if not yaml_path.exists():
        return examples
    try:
        data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    except (yaml.YAMLError, OSError):
        return examples
    ops = data.get("ops", []) if isinstance(data, dict) else []
    for op in ops:
        if not isinstance(op, dict):
            continue
        op_id = str(op.get("i", "op"))
        formula = str(op.get("f", ""))
        domain = str(op.get("domain", ""))
        guard = str(op.get("error_guard", ""))
        if not formula:
            continue
        key = hashlib.sha256(f"{op_id}|{formula}".encode()).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        desc = f"Домен: {domain}. {guard}".strip()
        user = formula_explain_user(op_id, op_id, formula, desc, "MMSS-Meta-v6")
        model = formula_explain_model(op_id, op_id, formula, desc, "MMSS-Meta-v6")
        examples.append(_example(user, model, str(yaml_path), "meta_yaml_op", "mmss-universal"))
        if len(examples) >= max_ops:
            break
    return examples


def extract_from_architectures(arch_dir: Path, max_items: int = 100) -> list[dict]:
    examples: list[dict] = []
    seen: set[str] = set()
    if not arch_dir.exists():
        return examples
    for path in sorted(arch_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        before = len(examples)
        _formula_examples_from_obj(
            data, str(path), "MMSS-Architecture", "architecture_formula",
            "mmss-universal", max_items, seen, examples,
        )
        if len(examples) == before:
            # architecture overview example
            meta = {}
            if isinstance(data, dict):
                top = next(iter(data.values()), {})
                if isinstance(top, dict):
                    meta = top.get("metadata", {})
            summary = json.dumps(meta, ensure_ascii=False, indent=2)[:2000]
            user = (
                f"Задача: опиши архитектурный блок MMSS V2.\n\n"
                f"Источник: {path.name}\n```json\n{summary}\n```\n"
                f"Верни JSON: status, version, architectural_class, core_invariants_summary"
            )
            model = json.dumps({
                "status": "ok",
                "version": meta.get("version", "unknown"),
                "architectural_class": meta.get("architectural_class", "MMSS"),
                "core_invariants_summary": "R_T, G_S, N, S, D_f — инварианты самомодифицирующейся MMSS архитектуры",
            }, ensure_ascii=False, indent=2)
            examples.append(_example(user, model, str(path), "architecture_overview", "mmss-universal"))
        if len(examples) >= max_items:
            break
    return examples


def _split_markdown_chunks(content: str, max_chunk: int = 3500) -> list[str]:
    parts = re.split(r"\n(?=#{1,3}\s)", content)
    chunks: list[str] = []
    buf = ""
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(part) > max_chunk:
            if buf:
                chunks.append(buf.strip())
                buf = ""
            for i in range(0, len(part), max_chunk):
                chunks.append(part[i:i + max_chunk])
            continue
        if len(buf) + len(part) + 2 > max_chunk:
            if buf:
                chunks.append(buf.strip())
            buf = part
        else:
            buf = f"{buf}\n\n{part}".strip() if buf else part
    if buf:
        chunks.append(buf.strip())
    return [c for c in chunks if len(c) >= 200]


def extract_from_raw_dataset(raw_dir: Path, max_docs: int = 400) -> list[dict]:
    examples: list[dict] = []
    if not raw_dir.exists():
        return examples
    seen: set[str] = set()
    files = sorted(
        list(raw_dir.rglob("*.md")) + list(raw_dir.rglob("*.txt")) + list(raw_dir.rglob("*.json")),
        key=lambda p: p.stat().st_size,
    )
    for path in files:
        if len(examples) >= max_docs:
            break
        try:
            if path.suffix.lower() == ".json":
                content = path.read_text(encoding="utf-8", errors="replace")
                try:
                    data = json.loads(content)
                    before = len(examples)
                    cat = _category_for_path(path, content)
                    _formula_examples_from_obj(
                        data, str(path), "MMSS-Raw", "raw_json_formula",
                        cat, max_docs, seen, examples,
                    )
                    if len(examples) > before:
                        continue
                except json.JSONDecodeError:
                    pass
            content = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if len(content.strip()) < 200:
            continue
        category = _category_for_path(path, content)
        for i, chunk in enumerate(_split_markdown_chunks(content)):
            key = hashlib.sha256(chunk[:500].encode()).hexdigest()
            if key in seen:
                continue
            seen.add(key)
            title = path.stem.replace("_", " ")
            user = (
                f"Задача: извлеки ключевые MMSS-концепции из документа.\n\n"
                f"Документ: {path.name} (фрагмент {i + 1})\n"
                f"```text\n{chunk[:3500]}\n```\n"
                f"Верни JSON: status, document, key_concepts, formulas_found, mmss_subsystems, summary"
            )
            formulas = re.findall(r'[A-Za-z_][A-Za-z0-9_]*\s*[=≡≝]\s*[^\n]{5,80}', chunk)[:5]
            model = json.dumps({
                "status": "ok",
                "document": path.name,
                "key_concepts": [w for w in ("PFR", "FRP", "A-MMSS", "MMSS", "R_T", "D_f", "η_R") if w in chunk][:6],
                "formulas_found": formulas,
                "mmss_subsystems": ["PFR"] if "PFR" in chunk else (["FRP"] if "FRP" in chunk else ["MMSS"]),
                "summary": chunk[:400].replace("\n", " ").strip() + ("..." if len(chunk) > 400 else ""),
            }, ensure_ascii=False, indent=2)
            examples.append(_example(user, model, str(path), "raw_document", category))
            if len(examples) >= max_docs:
                break
    return examples


def extract_from_source_archive(archive_dir: Path, max_files: int = 80) -> list[dict]:
    examples: list[dict] = []
    seen: set[str] = set()
    if not archive_dir.exists():
        return examples
    all_files = sorted(archive_dir.glob("*.md"), key=lambda p: p.name)
    priority = [p for p in all_files if any(k in p.name.lower() for k in ARCHIVE_PRIORITY)]
    rest = [p for p in all_files if p not in priority]
    selected = (priority + rest)[:max_files]
    for path in selected:
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        category = _category_for_path(path, content)
        # embedded JSON blocks
        for match in re.finditer(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", content):
            try:
                data = json.loads(match.group(1))
                _formula_examples_from_obj(
                    data, str(path), "MMSS-Archive", "archive_json_formula",
                    category, max_files * 3, seen, examples,
                )
            except json.JSONDecodeError:
                continue
        if len(content) < 300:
            continue
        chunk = content[:3500]
        key = hashlib.sha256(chunk.encode()).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        user = (
            f"Задача: резюмируй MMSS-архивный документ для fine-tuning.\n\n"
            f"Файл: {path.name}\n```text\n{chunk}\n```\n"
            f"Верни JSON: status, file, topic, formulas_count_estimate, relevance_to_mmss"
        )
        formula_count = len(re.findall(r'"formula"\s*:', content))
        model = json.dumps({
            "status": "ok",
            "file": path.name,
            "topic": path.stem.split("-")[-1] if "-" in path.stem else path.stem,
            "formulas_count_estimate": formula_count,
            "relevance_to_mmss": "high" if formula_count > 0 or "MMSS" in content else "medium",
        }, ensure_ascii=False, indent=2)
        examples.append(_example(user, model, str(path), "archive_summary", category))
    return examples


def extract_from_helper_json(helper_path: Path, max_items: int = 300) -> list[dict]:
    examples: list[dict] = []
    seen: set[str] = set()
    if not helper_path.exists():
        return examples
    try:
        data = json.loads(helper_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return examples
    if isinstance(data, list):
        for item in data:
            if not isinstance(item, dict):
                continue
            _formula_examples_from_obj(
                item, str(helper_path), "MMSS-Helper", "helper_formula",
                "mmss-universal", max_items, seen, examples,
            )
            if len(examples) >= max_items:
                break
    elif isinstance(data, dict):
        _formula_examples_from_obj(
            data, str(helper_path), "MMSS-Helper", "helper_formula",
            "mmss-universal", max_items, seen, examples,
        )
    return examples


def extract_from_ready_for_dataset(ready_dir: Path, max_items: int = 100) -> list[dict]:
    """Ingest any manually collected files from ready-for-dataset (excluding generated jsonl)."""
    examples: list[dict] = []
    if not ready_dir.exists():
        return examples
    for path in sorted(ready_dir.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() in (".jsonl", ".csv"):
            continue
        if path.suffix.lower() not in (".md", ".txt", ".json"):
            continue
        if "almost_ready" in path.parts:
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if len(content.strip()) < 100:
            continue
        category = _category_for_path(path, content)
        user = (
            f"Задача: обработай собранный MMSS-материал для датасета.\n\n"
            f"Файл: {path.name}\n```text\n{content[:3000]}\n```\n"
            f"Верни JSON: status, source_file, category, summary"
        )
        model = json.dumps({
            "status": "ok",
            "source_file": path.name,
            "category": category,
            "summary": content[:300].replace("\n", " ").strip(),
        }, ensure_ascii=False, indent=2)
        examples.append(_example(user, model, str(path), "ready_for_dataset", category))
        if len(examples) >= max_items:
            break
    return examples


def deduplicate_examples(examples: list[dict]) -> list[dict]:
    seen: set[str] = set()
    unique: list[dict] = []
    for ex in examples:
        msgs = ex.get("messages", [])
        key_src = json.dumps(msgs, ensure_ascii=False, sort_keys=True)
        key = hashlib.sha256(key_src.encode()).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        unique.append(ex)
    return unique
