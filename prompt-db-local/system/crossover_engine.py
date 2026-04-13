import json
import os
import random
import copy

def merge_params(p1, p2):
    res = copy.deepcopy(p1)
    for k, v in p2.items():
        if k in res:
            res[k] = round((res[k] + v) / 2, 2)
        else:
            res[k] = v
    return res

def main():
    index_path = os.path.join('database', 'system', 'block_index_v3.json')
    dest_dir = os.path.join('database', 'system', 'generated_blocks')
    report_path = os.path.join('database', 'system', 'crossover_report.json')
    
    if not os.path.exists(index_path):
        return

    with open(index_path, 'r', encoding='utf-8') as f:
        index = json.load(f)

    os.makedirs(dest_dir, exist_ok=True)
    
    report = {
        "generated_count": 0,
        "crossovers": []
    }
    
    candidates = [bid for bid, meta in index["blocks"].items() if meta["crossover_ready"]]
    
    for _ in range(min(10, len(candidates))):
        p1_id = random.choice(candidates)
        p2_id = random.choice(candidates)
        if p1_id == p2_id:
            continue
            
        p1_meta = index["blocks"][p1_id]
        p2_meta = index["blocks"][p2_id]
        
        # Simple compatibility check: same domain or adjacent layer
        if p1_meta["domain"] != p2_meta["domain"] and abs(p1_meta["layer"] - p2_meta["layer"]) > 1:
            continue
            
        with open(p1_meta["path"], 'r', encoding='utf-8') as f:
            p1_block = json.load(f)
        with open(p2_meta["path"], 'r', encoding='utf-8') as f:
            p2_block = json.load(f)
            
        strategy = "params_union" if p1_meta["domain"] == p2_meta["domain"] else "shared_domain_merge"
        
        child_id = f"cross_{random.getrandbits(16):x}"
        child_block = {
            "id": child_id,
            "op": random.choice([p1_block["op"], p2_block["op"]]),
            "attr": {
                "domain": p1_block["attr"]["domain"],
                "phase": p1_block["attr"]["phase"],
                "layer": p1_block["attr"]["layer"],
                "priority": round((p1_block["attr"]["priority"] + p2_block["attr"]["priority"]) / 2, 2)
            },
            "dna": {
                "seed_ref": child_id,
                "params": merge_params(p1_block["dna"]["params"], p2_block["dna"]["params"])
            },
            "synergy": {
                "links": list(set(p1_block["synergy"]["links"] + p2_block["synergy"]["links"])),
                "mode": "evolve"
            },
            "meta": {
                "intent": f"Hybrid: {p1_block['meta']['intent']} x {p2_block['meta']['intent']}"[:100],
                "confidence": round(min(p1_block["meta"]["confidence"], p2_block["meta"]["confidence"]) * 0.9, 2)
            },
            "origin": {
                "mode": "crossover",
                "parents": [p1_id, p2_id],
                "strategy": strategy
            },
            "legacy": {
                "parent_a": p1_block["legacy"],
                "parent_b": p2_block["legacy"]
            }
        }

        file_path = os.path.join(dest_dir, f"{child_id}.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(child_block, f, indent=2, ensure_ascii=False)
            
        report["generated_count"] += 1
        report["crossovers"].append({
            "id": child_id,
            "parents": [p1_id, p2_id],
            "strategy": strategy
        })

    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        
    print(f"Crossover engine generated {report['generated_count']} blocks.")

if __name__ == "__main__":
    main()
