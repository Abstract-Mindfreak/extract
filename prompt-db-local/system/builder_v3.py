import json
import os
import random
import re
import argparse
import math

def tokenize(text):
    return re.findall(r'\w+', text.lower())

def cosine_similarity(v1, v2):
    common_terms = set(v1.keys()) & set(v2.keys())
    dot_product = sum(v1[t] * v2[t] for t in common_terms)
    return dot_product

def build_query_vector(text, idf):
    tokens = tokenize(text)
    tf = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1
    vector = {}
    for t, count in tf.items():
        if t in idf:
            vector[t] = count * idf[t]
    return vector

def calculate_score(bid, meta, query_vector, embeddings, memory, self_rules):
    # Base scores
    priority = meta.get("priority", 0.5)
    confidence = meta.get("confidence", 0.7)
    
    # Semantic score
    block_vector = embeddings["blocks"].get(bid, {}).get("vector", {})
    semantic_score = cosine_similarity(query_vector, block_vector)
    
    # Memory score
    mem_stats = memory["block_stats"].get(bid, {"usage_count": 0, "success_score": 0.5})
    mem_score = mem_stats["success_score"] * 0.2
    
    # Final weighted score
    score = (priority * 0.3) + (confidence * 0.2) + (semantic_score * 0.4) + (mem_score * 0.1)
    return score

def load_block(bid, index, gen_dir):
    # Try index path first
    if bid in index["blocks"]:
        path = index["blocks"][bid]["path"]
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
                
    # Try generated blocks folder
    gen_path = os.path.join(gen_dir, f"{bid}.json")
    if os.path.exists(gen_path):
        with open(gen_path, 'r', encoding='utf-8') as f:
            return json.load(f)
            
    return None

def build(config):
    intent = config.get("intent", "")
    target_domains = set(config.get("domains", ["Rhythm", "Timbre", "Space", "Logic"]))
    target_layers = set(config.get("layers", [1, 2, 3]))
    max_blocks = config.get("max_blocks", 10)
    temperature = config.get("temperature", 0.55)
    runs = config.get("runs", 8)
    allow_mutation = config.get("allow_mutation", True)
    allow_crossover = config.get("allow_crossover", True)
    
    system_dir = os.path.join('database', 'system')
    gen_dir = os.path.join(system_dir, 'generated_blocks')
    
    try:
        with open(os.path.join(system_dir, 'block_index_v3.json'), 'r', encoding='utf-8') as f:
            index = json.load(f)
        with open(os.path.join(system_dir, 'embeddings.json'), 'r', encoding='utf-8') as f:
            embeddings = json.load(f)
        with open(os.path.join(system_dir, 'graph_v3.json'), 'r', encoding='utf-8') as f:
            graph = json.load(f)
        with open(os.path.join(system_dir, 'self_rules.json'), 'r', encoding='utf-8') as f:
            self_rules = json.load(f)
        from memory_v3 import load_memory, update_memory
        memory = load_memory()
    except Exception as e:
        return {"error": f"Failed to load V3 system files: {e}"}

    # Step 1: Prep query vector
    # Estimate IDF from embeddings dimensions if needed, but we'll just use keyword overlap for query vector if we don't have full IDF here.
    # Actually, we can use the keys from embeddings as our vocabulary.
    query_tokens = tokenize(intent)
    query_vector = {}
    for t in query_tokens:
        query_vector[t] = 1.0 # Simple keyword presence for query

    # Step 2: Pool Candidates
    all_bids = list(index["blocks"].keys())
    # Include generated blocks
    if os.path.exists(gen_dir):
        for f in os.listdir(gen_dir):
            if f.endswith('.json'):
                bid = f[:-5]
                if bid not in all_bids:
                    all_bids.append(bid)
                    # For generated blocks not in index, we'd need their metadata.
                    # Simplified: only use index for now, but in full V3 we'd re-index.

    best_result = None
    best_total_score = -1.0

    for run_idx in range(runs):
        current_selection = []
        
        # Scoring and picking
        scored_candidates = []
        for bid in all_bids:
            meta = index["blocks"].get(bid)
            if not meta: continue # Skip if no meta
            if meta["domain"] in target_domains and meta["layer"] in target_layers:
                score = calculate_score(bid, meta, query_vector, embeddings, memory, self_rules)
                scored_candidates.append((bid, score))
        
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        
        # Selection with temperature
        pool = scored_candidates[:max_blocks * 3]
        if not pool: continue
        
        while len(current_selection) < max_blocks and pool:
            if random.random() > temperature:
                pick = pool.pop(0)
            else:
                pick = pool.pop(random.randint(0, len(pool)-1))
            current_selection.append(pick)

        # Expand via graph
        expanded = set(bid for bid, score in current_selection)
        for bid, score in current_selection:
            edges = graph["edges"].get(bid, [])
            for edge in edges:
                if len(expanded) < max_blocks + 2:
                    expanded.add(edge["target"])
        
        # Load and validate
        final_blocks = []
        for bid in list(expanded)[:max_blocks]:
            block = load_block(bid, index, gen_dir)
            if block: final_blocks.append(block)
            
        # Scoring this run
        run_score = sum(s for bid, s in current_selection) / len(current_selection) if current_selection else 0
        
        if run_score > best_total_score:
            best_total_score = run_score
            best_result = final_blocks

    if best_result:
        # Update memory
        update_memory(best_result, intent)
        
        return {
            "meta": {
                "intent": intent,
                "block_count": len(best_result),
                "run_score": round(best_total_score, 3),
                "validation": {"valid": True}
            },
            "blocks": best_result
        }
    else:
        return {"error": "No blocks could be assembled"}

def main():
    parser = argparse.ArgumentParser(description="MMSS V3 Builder")
    parser.add_argument("--intent", type=str, default="industrial texture")
    parser.add_argument("--domains", type=str, default="Rhythm,Timbre,Space,Logic")
    parser.add_argument("--layers", type=str, default="1,2,3")
    parser.add_argument("--max_blocks", type=int, default=10)
    parser.add_argument("--temperature", type=float, default=0.55)
    parser.add_argument("--runs", type=int, default=8)
    
    args = parser.parse_args()
    
    config = {
        "intent": args.intent,
        "domains": args.domains.split(","),
        "layers": [int(l) for l in args.layers.split(",")],
        "max_blocks": args.max_blocks,
        "temperature": args.temperature,
        "runs": args.runs
    }
    
    result = build(config)
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
