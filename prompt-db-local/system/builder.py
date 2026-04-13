import json
import os
import random
import re

MEMORY_PATH = 'prompt-db-local/database/system/memory.json'


# =========================
# TEXT UTILS
# =========================
def normalize_text(text):
    return set(re.findall(r'\w+', text.lower()))


# =========================
# MEMORY SYSTEM
# =========================
def load_memory():
    if not os.path.exists(MEMORY_PATH):
        return {"block_stats": {}}
    try:
        with open(MEMORY_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {"block_stats": {}}


def save_memory(memory):
    os.makedirs(os.path.dirname(MEMORY_PATH), exist_ok=True)
    with open(MEMORY_PATH, 'w', encoding='utf-8') as f:
        json.dump(memory, f, indent=2, ensure_ascii=False)


def get_memory_score(bid, memory):
    stats = memory["block_stats"].get(bid)
    if not stats:
        return 0.5
    
    usage = stats.get("usage_count", 1)
    success = stats.get("success_score", 0.5)
    
    # логарифмическое насыщение
    usage_factor = min(1.0, usage / 10)
    
    return (success * 0.7) + (usage_factor * 0.3)


def update_memory(memory, result):
    is_valid = 1 if result["meta"]["validation"]["valid"] else 0

    for block in result["blocks"]:
        bid = block["id"]
        
        stats = memory["block_stats"].setdefault(bid, {
            "usage_count": 0,
            "success_score": 0.5
        })
        
        stats["usage_count"] += 1
        
        # EMA обновление
        stats["success_score"] = (
            stats["success_score"] * 0.8 +
            is_valid * 0.2
        )
    
    return memory


# =========================
# SCORING
# =========================
def calculate_score(block_meta, intent_keywords, memory_score):
    priority = block_meta.get("priority", 0.5)
    confidence = block_meta.get("confidence", 0.7)
    
    block_tags = set(block_meta.get("tags", []))
    overlap = intent_keywords.intersection(block_tags)
    intent_match = len(overlap) / len(intent_keywords) if intent_keywords else 0

    score = (
        priority * 0.25 +
        confidence * 0.2 +
        intent_match * 0.3 +
        memory_score * 0.25
    )
    
    return score


# =========================
# IO
# =========================
def load_block(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


# =========================
# CORE BUILDER
# =========================
def build(config):
    intent = config.get("intent", "")
    target_domains = set(config.get("domains", ["Rhythm", "Timbre", "Space", "Logic"]))
    target_layers = set(config.get("layers", [1, 2, 3]))
    max_blocks = config.get("max_blocks", 12)
    temperature = config.get("temperature", 0.7)

    memory = load_memory()

    # Load system files
    try:
        with open('prompt-db-local/database/system/block_index.json', 'r', encoding='utf-8') as f:
            index = json.load(f)
        with open('prompt-db-local/database/system/graph.json', 'r', encoding='utf-8') as f:
            graph = json.load(f)
        with open('prompt-db-local/database/system/rules.json', 'r', encoding='utf-8') as f:
            rules = json.load(f)
    except Exception as e:
        return {"error": f"Failed to load system files: {e}"}

    intent_keywords = normalize_text(intent)

    # =========================
    # STEP 1: FILTER + SCORE
    # =========================
    candidates = []

    for bid, meta in index["blocks"].items():
        if meta["domain"] in target_domains and meta["layer"] in target_layers:
            if meta["confidence"] > 0.3:
                
                memory_score = get_memory_score(bid, memory)
                
                score = calculate_score(meta, intent_keywords, memory_score)
                
                candidates.append((bid, score, meta))

    if not candidates:
        return {"error": "No blocks found matching criteria"}

    candidates.sort(key=lambda x: x[1], reverse=True)

    # =========================
    # STEP 2: SELECTION
    # =========================
    top_k = candidates[:max_blocks * 2]

    selected_ids = set()

    for _ in range(min(max_blocks, len(top_k))):
        if random.random() > temperature:
            for bid, score, meta in top_k:
                if bid not in selected_ids:
                    selected_ids.add(bid)
                    break
        else:
            pick = random.choice(top_k)
            selected_ids.add(pick[0])

    # =========================
    # STEP 3: GRAPH EXPANSION
    # =========================
    expanded_ids = set(selected_ids)

    for bid in selected_ids:
        links = graph["edges"].get(bid, [])
        for link in links:
            if len(expanded_ids) >= max_blocks + 4:
                break
            expanded_ids.add(link)

    # =========================
    # STEP 4: LOAD BLOCKS
    # =========================
    final_blocks_pool = [
        load_block(index["blocks"][bid]["path"])
        for bid in expanded_ids
        if bid in index["blocks"]
    ]

    final_selection = final_blocks_pool[:max_blocks]

    # =========================
    # VALIDATION
    # =========================
    from rule_engine import validate_selection
    validation = validate_selection(final_selection, rules)

    result = {
        "meta": {
            "intent": intent,
            "block_count": len(final_selection),
            "validation": validation
        },
        "blocks": final_selection
    }

    # =========================
    # STEP 5: MEMORY UPDATE
    # =========================
    memory = update_memory(memory, result)
    save_memory(memory)

    return result


# =========================
# TEST RUN
# =========================
if __name__ == "__main__":
    test_config = {
        "intent": "deep hypnotic techno with spatial diffusion and industrial textures",
        "domains": ["Rhythm", "Timbre", "Space", "Logic"],
        "layers": [1, 2, 3],
        "max_blocks": 8,
        "temperature": 0.5
    }

    result = build(test_config)
    print(json.dumps(result, indent=2, ensure_ascii=False))