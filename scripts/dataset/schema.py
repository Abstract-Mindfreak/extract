"""Gemma 4 E2B JSONL schema and global MMSS system prompt."""

GLOBAL_SYSTEM_PROMPT_RU = """Ты — модуль обработки MMSS-данных и локального RAG.

Твоя задача — по запросу пользователя и предоставленному контексту строить структурированный, детерминированный вывод для использования внутри MMSS-систем.

Правила:
1. Используй только данные из явного контекста (MMSS-блоки, формулы, метрики, документы). Не добавляй внешние знания.
2. Если данных недостаточно — верни status "needs_more_context".
3. Всегда соблюдай заданный формат ответа (JSON / Markdown / MMSS-протокол).
4. Сохраняй терминологию MMSS: V, N, S, D_f, G_S, R_T, η_R, операторы PFR/FRP/A-MMSS.
5. Не включай chain-of-thought, если явно не запрошено.
6. При конфликте источников — status "conflict" с описанием в notes.

Ты знаешь три ядра MMSS:
- PFR (Практическая Фрактальная Пересборка): оператор R_f, метрика η_R
- FRP (Темпоральная Навигация): рекурсивные сценарии, Ω-операторы
- A-MMSS (Плетение Контекста): контекстуальное дерево, этическая стабилизация"""


def make_example(system: str, user: str, model: str) -> dict:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})
    messages.append({"role": "model", "content": model})
    return {"messages": messages}


def formula_explain_user(formula_id: str, name: str, formula: str, description: str, subsystem: str) -> str:
    return f"Analyze MMSS formula: identify invariants, subsystem, and impact on metrics. Output: {{status, formula_id, subsystem, meaning, affects_metrics, usage_context}}. Use only provided data. Seek hidden dependencies and fractal patterns. Formula ID: {formula_id}. Name: {name}. Subsystem: {subsystem}. Formula: {formula}. Description: {description}"


def formula_explain_model(formula_id: str, name: str, formula: str, description: str, subsystem: str) -> str:
    import json
    return json.dumps({
        "status": "ok",
        "formula_id": formula_id,
        "subsystem": subsystem,
        "meaning": description,
        "affects_metrics": ["V", "eta_R", "G_S"] if subsystem == "PFR" else ["S", "D_f", "R_T"],
        "usage_context": f"Формула {name} применяется в {subsystem} для оптимизации: {formula}",
    }, ensure_ascii=False, indent=2)


def block_explain_user(block: dict) -> str:
    domain = block.get("attr", {}).get("domain", "Unknown")
    block_name = block.get("legacy", {}).get("block_name", block.get("id", "?"))
    block_data = __import__('json').dumps(block, ensure_ascii=False, indent=2)[:3000]
    return f"Analyze MMSS block: identify domain, operator, intent, and synergy mode. Output: {{status, block_name, domain, operator_summary, intent, synergy_mode}}. Use only provided data. Seek hidden dependencies and fractal patterns. Domain: {domain}. Block: {block_name}. Block data: {block_data}"


def block_explain_model(block: dict) -> str:
    import json
    legacy = block.get("legacy", {})
    meta = block.get("meta", {})
    op_spec = legacy.get("operator_G_specification", {})
    return json.dumps({
        "status": "ok",
        "block_name": legacy.get("block_name", block.get("id")),
        "domain": block.get("attr", {}).get("domain"),
        "operator_summary": op_spec.get("function", block.get("op", "M")),
        "intent": meta.get("intent", ""),
        "synergy_mode": block.get("synergy", {}).get("mode", "add"),
    }, ensure_ascii=False, indent=2)


def engine_doc_user(module_name: str, docstring: str, class_names: list) -> str:
    return f"Analyze MMSS Python module: identify purpose, key classes, and subsystem. Output: {{status, module, purpose, key_classes, subsystem}}. Use only provided data. Seek hidden dependencies and fractal patterns. Module: {module_name}. Classes: {', '.join(class_names)}. Documentation: {docstring[:2000]}"


def engine_doc_model(module_name: str, docstring: str, class_names: list, subsystem: str) -> str:
    import json
    first_line = docstring.strip().split("\n")[0] if docstring else module_name
    return json.dumps({
        "status": "ok",
        "module": module_name,
        "purpose": first_line,
        "key_classes": class_names,
        "subsystem": subsystem,
    }, ensure_ascii=False, indent=2)
