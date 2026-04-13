import json
import os

def main():
    index_path = os.path.join('database', 'system', 'block_index_v3.json')
    graph_path = os.path.join('database', 'system', 'graph_v3.json')
    output_path = os.path.join('database', 'system', 'self_rules.json')
    
    if not os.path.exists(index_path) or not os.path.exists(graph_path):
        return

    with open(index_path, 'r', encoding='utf-8') as f:
        index = json.load(f)
    with open(graph_path, 'r', encoding='utf-8') as f:
        graph = json.load(f)

    rules = {
        "version": "3.0",
        "generated_rules": []
    }

    # Pattern 1: Domain Affinity (which domains connect most)
    domain_connections = {}
    for bid, edges in graph["edges"].items():
        my_domain = index["blocks"][bid]["domain"]
        for edge in edges:
            target_domain = index["blocks"][edge["target"]]["domain"]
            pair = tuple(sorted([my_domain, target_domain]))
            domain_connections[pair] = domain_connections.get(pair, 0) + 1
            
    # Convert frequent connections into rules
    for pair, count in domain_connections.items():
        if count > 20:
            rules["generated_rules"].append({
                "name": f"affinity_{pair[0]}_{pair[1]}",
                "type": "domain_affinity",
                "weight": round(min(count / 100, 1.0), 2),
                "rule": {"domains": list(pair)},
                "evidence": {"connection_count": count}
            })

    # Pattern 2: Layer Correlation
    layer_pairs = {}
    for bid, edges in graph["edges"].items():
        my_layer = index["blocks"][bid]["layer"]
        for edge in edges:
            target_layer = index["blocks"][edge["target"]]["layer"]
            pair = tuple(sorted([my_layer, target_layer]))
            layer_pairs[pair] = layer_pairs.get(pair, 0) + 1
            
    for pair, count in layer_pairs.items():
        if count > 15:
            rules["generated_rules"].append({
                "name": f"layer_correl_{pair[0]}_{pair[1]}",
                "type": "layer_correlation",
                "weight": round(min(count / 80, 1.0), 2),
                "rule": {"layers": list(pair)},
                "evidence": {"connection_count": count}
            })

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(rules, f, indent=2, ensure_ascii=False)
        
    print(f"Self-rule engine generated {len(rules['generated_rules'])} rules to {output_path}")

if __name__ == "__main__":
    main()
