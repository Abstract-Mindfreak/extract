import json
import os

def load_memory():
    path = os.path.join('database', 'system', 'memory_v3.json')
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "block_stats": {},
        "intent_stats": {},
        "generation_stats": {}
    }

def save_memory(memory):
    path = os.path.join('database', 'system', 'memory_v3.json')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(memory, f, indent=2, ensure_ascii=False)

def update_memory(blocks, intent):
    memory = load_memory()
    
    # Update block usage
    for b in blocks:
        bid = b["id"]
        stats = memory["block_stats"].get(bid, {
            "usage_count": 0,
            "success_score": 0.5,
            "penalty_score": 0.0,
            "novelty_score": 0.5,
            "lineage_score": 0.5
        })
        stats["usage_count"] += 1
        memory["block_stats"][bid] = stats
        
        # Lineage update
        if "origin" in b:
            gen_id = b["id"]
            memory["generation_stats"][gen_id] = {
                "parent_ids": b["origin"].get("parents", []),
                "stability_score": 0.7
            }

    # Simplified intent signature
    sig = intent.lower()[:50]
    if sig not in memory["intent_stats"]:
        memory["intent_stats"][sig] = {}
        
    for b in blocks:
        bid = b["id"]
        memory["intent_stats"][sig][bid] = memory["intent_stats"][sig].get(bid, 0) + 0.1

    save_memory(memory)
    print("Memory V3 updated.")

if __name__ == "__main__":
    # Test
    mem = load_memory()
    print(f"Memory loaded with {len(mem['block_stats'])} block stats.")
