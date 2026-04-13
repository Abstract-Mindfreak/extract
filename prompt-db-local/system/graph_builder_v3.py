import json
import os
import math

def cosine_similarity(v1, v2):
    common_terms = set(v1.keys()) & set(v2.keys())
    dot_product = sum(v1[t] * v2[t] for t in common_terms)
    return dot_product

def main():
    blocks_root = os.path.join('database', 'blocks')
    index_path = os.path.join('database', 'system', 'block_index_v3.json')
    embeddings_path = os.path.join('database', 'system', 'embeddings.json')
    output_path = os.path.join('database', 'system', 'graph_v3.json')
    
    if not os.path.exists(index_path) or not os.path.exists(embeddings_path):
        print("Required files missing for Graph V3")
        return

    with open(index_path, 'r', encoding='utf-8') as f:
        index = json.load(f)
    with open(embeddings_path, 'r', encoding='utf-8') as f:
        embeddings = json.load(f)

    graph = {
        "version": "3.0",
        "nodes": list(index["blocks"].keys()),
        "edges": {}
    }

    # Pre-load full block data for explicit links
    full_data = {}
    for bid, meta in index["blocks"].items():
        with open(meta["path"], 'r', encoding='utf-8') as f:
            full_data[bid] = json.load(f)

    for bid, block in full_data.items():
        edges = []
        my_meta = index["blocks"][bid]
        my_vector = embeddings["blocks"][bid]["vector"]
        
        for other_id, other_meta in index["blocks"].items():
            if other_id == bid:
                continue
            
            reasons = []
            weight = 0.0
            
            # 1. Explicit links
            if other_id in block.get("synergy", {}).get("links", []):
                reasons.append("explicit_link")
                weight += 0.5
            
            # 2. Same domain weighted proximity
            if my_meta["domain"] == other_meta["domain"]:
                reasons.append("same_domain")
                weight += 0.1
                
            # 3. Adjacent layer synergy
            if abs(my_meta["layer"] - other_meta["layer"]) == 1:
                reasons.append("adjacent_layer")
                weight += 0.1
                
            # 4. Semantic similarity
            other_vector = embeddings["blocks"][other_id]["vector"]
            sim = cosine_similarity(my_vector, other_vector)
            if sim > 0.3:
                reasons.append("semantic_similarity")
                weight += sim * 0.3
                
            if weight > 0:
                edges.append({
                    "target": other_id,
                    "weight": round(min(weight, 1.0), 3),
                    "reasons": reasons
                })
        
        # Sort and keep top-10
        edges.sort(key=lambda x: x["weight"], reverse=True)
        graph["edges"][bid] = edges[:10]

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(graph, f, indent=2, ensure_ascii=False)
        
    print(f"Graph V3 built for {len(graph['nodes'])} nodes to {output_path}")

if __name__ == "__main__":
    main()
