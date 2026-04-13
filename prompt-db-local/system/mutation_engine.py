import json
import os
import random
import copy

def mutate_params(params):
    new_params = copy.deepcopy(params)
    for k, v in new_params.items():
        if isinstance(v, (int, float)):
            # Tweak by +/- 10%
            shift = 1.0 + (random.uniform(-0.1, 0.1))
            new_params[k] = round(v * shift, 2)
    return new_params

def main():
    index_path = os.path.join('database', 'system', 'block_index_v3.json')
    dest_dir = os.path.join('database', 'system', 'generated_blocks')
    report_path = os.path.join('database', 'system', 'mutation_report.json')
    
    if not os.path.exists(index_path):
        return

    with open(index_path, 'r', encoding='utf-8') as f:
        index = json.load(f)

    os.makedirs(dest_dir, exist_ok=True)
    
    report = {
        "generated_count": 0,
        "mutations": []
    }
    
    # Pick mutation-ready blocks
    candidates = [bid for bid, meta in index["blocks"].items() if meta["mutation_ready"]]
    
    for _ in range(min(20, len(candidates))):
        parent_id = random.choice(candidates)
        parent_meta = index["blocks"][parent_id]
        
        with open(parent_meta["path"], 'r', encoding='utf-8') as f:
            parent_block = json.load(f)
            
        mutation_type = random.choice(["param_shift", "phase_shift", "detail_amplification"])
        
        child_block = copy.deepcopy(parent_block)
        child_id = f"mut_{parent_id}_{random.getrandbits(16):x}"
        child_block["id"] = child_id
        child_block["origin"] = {
            "mode": "mutation",
            "parents": [parent_id],
            "mutation_type": mutation_type
        }
        
        if mutation_type == "param_shift":
            child_block["dna"]["params"] = mutate_params(parent_block["dna"]["params"])
        elif mutation_type == "phase_shift":
            phases = ["emergence", "stabilization", "shift", "collapse"]
            child_block["attr"]["phase"] = random.choice(phases)
        elif mutation_type == "detail_amplification":
            child_block["attr"]["priority"] = min(parent_block["attr"]["priority"] + 0.1, 1.0)
            child_block["meta"]["confidence"] = max(parent_block["meta"]["confidence"] - 0.1, 0.1)

        file_path = os.path.join(dest_dir, f"{child_id}.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(child_block, f, indent=2, ensure_ascii=False)
            
        report["generated_count"] += 1
        report["mutations"].append({
            "id": child_id,
            "parent": parent_id,
            "type": mutation_type
        })

    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        
    print(f"Mutation engine generated {report['generated_count']} blocks.")

if __name__ == "__main__":
    main()
