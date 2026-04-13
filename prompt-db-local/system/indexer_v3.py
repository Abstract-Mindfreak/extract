import json
import os
import re

def normalize_tag(tag):
    tag = tag.lower().strip()
    tag = re.sub(r'[^a-z0-9]', '_', tag)
    tag = re.sub(r'_+', '_', tag)
    return tag.strip('_')

def extract_tags(block):
    tags = set()
    tags.add(normalize_tag(str(block.get("id", ""))))
    
    intent = block.get("meta", {}).get("intent", "")
    if intent and intent != "unknown":
        words = re.findall(r'\w+', intent.lower())
        for word in words:
            if len(word) > 3:
                tags.add(normalize_tag(word))
                
    attr = block.get("attr", {})
    tags.add(normalize_tag(attr.get("domain", "")))
    tags.add(normalize_tag(attr.get("phase", "")))
    tags.add(normalize_tag(block.get("op", "")))
    
    legacy = block.get("legacy", {})
    for key, value in legacy.items():
        tags.add(normalize_tag(key))
        if isinstance(value, str) and len(value) < 50:
            words = re.findall(r'\w+', value.lower())
            for word in words:
                if len(word) > 3:
                    tags.add(normalize_tag(word))
        
    return sorted(list(filter(None, tags)))

def is_mutation_ready(block):
    # Mutation is possible if there are numeric parameters to shift
    params = block.get("dna", {}).get("params", {})
    return len(params) > 0

def is_crossover_ready(block):
    # Crossover is possible if it's a standard operational block (not meta-only)
    return block.get("op") in ["G", "Q", "Φ"]

def main():
    blocks_root = os.path.join('database', 'blocks')
    output_path = os.path.join('database', 'system', 'block_index_v3.json')
    
    index = {
        "version": "3.0",
        "total_blocks": 0,
        "domains": {
            "Rhythm": [],
            "Timbre": [],
            "Space": [],
            "Logic": []
        },
        "blocks": {}
    }
    
    if not os.path.exists(blocks_root):
        print(f"Blocks root not found: {blocks_root}")
        return

    for root, dirs, files in os.walk(blocks_root):
        for file in files:
            if file.endswith('.json'):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    try:
                        block = json.load(f)
                    except Exception as e:
                        print(f"Error reading {file_path}: {e}")
                        continue
                        
                    bid = block["id"]
                    attr = block["attr"]
                    domain = attr["domain"]
                    
                    index["total_blocks"] += 1
                    if domain in index["domains"]:
                        index["domains"][domain].append(bid)
                    
                    index["blocks"][bid] = {
                        "path": os.path.relpath(file_path, os.getcwd()),
                        "domain": domain,
                        "layer": attr["layer"],
                        "op": block.get("op", "G"),
                        "phase": attr["phase"],
                        "priority": attr.get("priority", 0.5),
                        "confidence": block.get("meta", {}).get("confidence", 0.7),
                        "tags": extract_tags(block),
                        "params_keys": list(block.get("dna", {}).get("params", {}).keys()),
                        "embedding_ref": bid,
                        "mutation_ready": is_mutation_ready(block),
                        "crossover_ready": is_crossover_ready(block)
                    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
        
    print(f"Indexed {index['total_blocks']} blocks to {output_path}")

if __name__ == "__main__":
    main()
