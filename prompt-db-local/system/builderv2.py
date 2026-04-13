import json
import os
import random
import re
import math

# =========================
# PATHS
# =========================
BASE_PATH = 'prompt-db-local/database/system'
MEMORY_PATH = os.path.join(BASE_PATH, 'memory_v2.json')

# =========================
# TEXT
# =========================
def normalize_text(text):
    return set(re.findall(r'\w+', text.lower()))

def intent_signature(intent):
    words = sorted(list(normalize_text(intent)))
    return "_".join(words[:10])


# =========================
# MEMORY SYSTEM V2
# =========================
def load_memory():
    if not os.path.exists(MEMORY_PATH):
        return {
            "block_stats": {},
            "intent_stats": {}
        }
    try:
        with open(MEMORY_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {
            "block_stats": {},
            "intent_stats": {}
        }

def save_memory(memory):
    os.makedirs(os.path.dirname(MEMORY_PATH), exist_ok=True)
    with open(MEMORY_PATH, 'w', encoding='utf-8') as f:
        json.dump(memory, f, indent=2, ensure_ascii=False)


# =========================
# MEMORY SCORING
# =========================
def get_block_memory_score(bid, memory):
    stats = memory["block_stats"].get(bid)

    if not stats:
        return 0.5

    usage = stats.get("usage_count", 1)
    success = stats.get("success_score", 0.5)
    penalty = stats.get("penalty_score", 0.0)

    usage_factor = min(1.0, math.log1p(usage) / 3)

    score = (
        success * 0.6 +
        usage_factor * 0.2 -
        penalty * 0.4
    )

    return max(0.0, min(1.0, score))


def get_intent_memory_boost(bid, intent_sig, memory):
    intent_data = memory["intent_stats"].get(intent_sig, {})
    score = intent_data.get(bid, 0.5)
    return score


# =========================
# MEMORY UPDATE
# =========================
def update_memory(memory, result, intent_sig):
    is_valid = 1 if result["meta"]["validation"]["valid"] else 0

    for block in result["blocks"]:
        bid = block["id"]

        stats = memory["block_stats"].setdefault(bid, {
            "usage_count": 0,
            "success_score": 0.5,
            "penalty_score": 0.0
        })

        stats["usage_count"] += 1

        # success update
        stats["success_score"] = (
            stats["success_score"] * 0.8 +
            is_valid * 0.2
        )

        # penalty update (если невалидно — штрафуем)
        if not is_valid:
            stats["penalty_score"] = min(
                1.0,
                stats["penalty_score"] * 0.7 + 0.3
            )
        else:
            stats["penalty_score"] *= 0.9

        # intent memory
        intent_map = memory["intent_stats"].setdefault(intent_sig, {})
        current = intent_map.get(bid, 0.5)

        intent_map[bid] = (
            current * 0.7 +
            is_valid * 0.3
        )

    return memory


# =========================
# SCORING
# =========================
def calculate_score(meta, intent_keywords, memory_score, intent_boost):
    priority = meta.get("priority", 0.5)
    confidence = meta.get("confidence", 0.7)

    block_tags = set(meta.get("tags", []))
    overlap = intent_keywords.intersection(block_tags)

    intent_match = len(overlap) / len(intent_keywords) if intent_keywords else 0

    score = (
        priority * 0.2 +
        confidence * 0.2 +
        intent_match * 0.3 +
        memory_score * 0.2 +
        intent_boost * 0.1
    )

    return score


# =========================
# IO
# =========================
def load_block(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


# =========================
# SINGLE BUILD
# =========================
def single_build(config, memory):
    intent = config.get("intent", "")
    intent_sig = intent_signature(intent)

    target_domains = set(config.get("domains", ["Rhythm", "Timbre", "Space", "Logic"]))
    target_layers = set(config.get("layers", [1, 2, 3]))
    max_blocks = config.get("max_blocks", 12)
    temperature = config.get("temperature", 0.7)

    with open('prompt-db-local/database/system/block_index.json', 'r', encoding='utf-8') as f:
        index = json.load(f)

    with open('prompt-db-local/database/system/graph.json', 'r', encoding='utf-8') as f:
        graph = json.load(f)

    with open('prompt-db-local/database/system/rules.json', 'r', encoding='utf-8') as f:
        rules = json.load(f)

    intent_keywords = normalize_text(intent)

    candidates = []

    for bid, meta in index["blocks"].items():
        if meta["domain"] in target_domains and meta["layer"] in target_layers:
            if meta["confidence"] > 0.3:

                mem_score = get_block_memory_score(bid, memory)
                intent_boost = get_intent_memory_boost(bid, intent_sig, memory)

                score = calculate_score(meta, intent_keywords, mem_score, intent_boost)

                candidates.append((bid, score, meta))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[1], reverse=True)

    pool = candidates[:max_blocks * 3]

    selected = set()

    for _ in range(max_blocks):
        if random.random() > temperature:
            for bid, score, meta in pool:
                if bid not in selected:
                    selected.add(bid)
                    break
        else:
            selected.add(random.choice(pool)[0])

    expanded = set(selected)

    for bid in selected:
        links = graph["edges"].get(bid, [])
        for link in links:
            if len(expanded) > max_blocks + 5:
                break
            expanded.add(link)

    blocks = []
    for bid in expanded:
        if bid in index["blocks"]:
            blocks.append(load_block(index["blocks"][bid]["path"]))

    blocks = blocks[:max_blocks]

    from rule_engine import validate_selection
    validation = validate_selection(blocks, rules)

    return {
        "meta": {
            "intent": intent,
            "validation": validation
        },
        "blocks": blocks
    }


# =========================
# MULTI-RUN EVOLUTION
# =========================
def build(config):
    runs = config.get("runs", 5)

    memory = load_memory()

    intent = config.get("intent", "")
    intent_sig = intent_signature(intent)

    best_result = None
    best_score = -1

    for _ in range(runs):
        result = single_build(config, memory)

        if not result:
            continue

        valid = result["meta"]["validation"]["valid"]

        diversity = len(set(b["attr"]["domain"] for b in result["blocks"]))

        score = (1 if valid else 0) * 0.6 + diversity * 0.4

        if score > best_score:
            best_score = score
            best_result = result

        memory = update_memory(memory, result, intent_sig)

    save_memory(memory)

    return best_result


# =========================
# TEST
# =========================
if __name__ == "__main__":
    config = {
        "intent": "deep hypnotic techno evolving industrial spatial system",
        "domains": ["Rhythm", "Timbre", "Space", "Logic"],
        "layers": [1, 2, 3],
        "max_blocks": 8,
        "temperature": 0.6,
        "runs": 6
    }

    result = build(config)

    print(json.dumps(result, indent=2, ensure_ascii=False))