import json
import os
import re
import shutil
import time

def extract_params(block):
    params = {}
    def search_recursive(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if isinstance(v, (int, float)): params[k] = v
                elif isinstance(v, str):
                    matches = re.findall(r'(\d+(?:\.\d+)?)\s*(BPM|Hz|dB|ms|s|kHz)', v, re.IGNORECASE)
                    for val, unit in matches: params[f"{k}_{unit.lower()}"] = float(val)
                search_recursive(v)
        elif isinstance(obj, list):
            for item in obj: search_recursive(item)
    search_recursive(block)
    return params

def determine_domain(block_str):
    low = block_str.lower()
    if any(w in low for w in ["bpm", "rhythm", "beat", "kick", "grid", "percussion"]): return "Rhythm"
    if any(w in low for w in ["spatial", "reverb", "delay", "pan", "width", "garden", "space"]): return "Space"
    if any(w in low for w in ["logic", "protocol", "algorithm", "meta", "system", "formula"]): return "Logic"
    return "Timbre"

def determine_layer(block_str, domain):
    if domain == "Logic": return 3
    low = block_str.lower()
    if any(w in low for w in ["base", "kick", "pulse", "foundation"]): return 1
    if any(w in low for w in ["meta", "singularity", "omega", "genesis"]): return 3
    return 2

def determine_phase(block_str):
    low = block_str.lower()
    if any(w in low for w in ["death", "annihilation", "wipe", "zero", "null", "collapse"]): return "collapse"
    if any(w in low for w in ["mutation", "change", "variation", "evolution", "shift"]): return "shift"
    if any(w in low for w in ["stable", "complete", "locked", "stabilization"]): return "stabilization"
    return "emergence"

def determine_op(block_str):
    low = block_str.lower()
    if any(w in low for w in ["logic", "protocol", "algorithm", "meta"]): return "M"
    if any(w in low for w in ["spatial", "pan", "width", "synergy"]): return "Φ"
    if any(w in low for w in ["filter", "distort", "spectral", "process"]): return "Q"
    return "G"

def transform_block(block, index):
    block_id = str(block.get("block_id") or block.get("sub_block_id") or f"meta_{index}")
    block_str = json.dumps(block)
    domain = determine_domain(block_str)
    layer = determine_layer(block_str, domain)
    intent = "unknown"
    insight = block.get("internal_insight", {})
    if isinstance(insight, dict):
        for v in insight.values():
            if isinstance(v, str): intent = v.split('.')[0][:100]; break
    elif isinstance(insight, str): intent = insight.split('.')[0][:100]
    return {
        "id": block_id, "op": determine_op(block_str),
        "attr": {"domain": domain, "phase": determine_phase(block_str), "layer": layer, "priority": 0.5},
        "dna": {"seed_ref": block_id, "params": extract_params(block)},
        "synergy": {"links": list(set(re.findall(r'Block (\d+(?:\.\d+)?)', block_str))), "mode": "add"},
        "meta": {"intent": intent, "confidence": 0.7},
        "legacy": block
    }

def main():
    src = os.path.join('database', 'producer-ai-base.json')
    dest = os.path.join('database', 'blocks')
    if not os.path.exists(src): 
        print(f"Source not found: {src}")
        return
    with open(src, 'r', encoding='utf-8') as f: data = json.load(f)
    if os.path.exists(dest):
        for _ in range(5):
            try: shutil.rmtree(dest); break
            except: time.sleep(1)
    os.makedirs(dest, exist_ok=True)
    for i, block in enumerate(data):
        t = transform_block(block, i)
        d_path = os.path.join(dest, t["attr"]["domain"], f"layer{t['attr']['layer']}")
        os.makedirs(d_path, exist_ok=True)
        f_path = os.path.join(d_path, f"{t['id']}.json")
        if os.path.exists(f_path): f_path = os.path.join(d_path, f"{t['id']}_{i}.json")
        with open(f_path, 'w', encoding='utf-8') as f: json.dump(t, f, indent=2, ensure_ascii=False)
    print(f"Processed {len(data)} blocks.")

if __name__ == "__main__": main()
