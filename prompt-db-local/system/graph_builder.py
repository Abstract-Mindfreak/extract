import json
import os

def main():
    blocks_root = os.path.join('prompt-db-local', 'database', 'blocks')
    output_path = os.path.join('prompt-db-local', 'database', 'system', 'graph.json')
    
    graph = {
        "nodes": [],
        "edges": {}
    }
    
    # Pre-scan blocks to get data
    all_blocks_data = {}
    for root, dirs, files in os.walk(blocks_root):
        for file in files:
            if file.endswith('.json'):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    block = json.load(f)
                    bid = block["id"]
                    all_blocks_data[bid] = block
                    graph["nodes"].append(bid)

    # Build edges
    for bid, block in all_blocks_data.items():
        edges = set()
        
        # 1. Explicit links
        explicit_links = block.get("synergy", {}).get("links", [])
        for link in explicit_links:
            if link in all_blocks_data and link != bid:
                edges.add(link)
                
        # 2. Semantic links: same domain, different layer
        my_domain = block["attr"]["domain"]
        my_layer = block["attr"]["layer"]
        
        for other_id, other_block in all_blocks_data.items():
            if other_id == bid:
                continue
            
            if other_block["attr"]["domain"] == my_domain:
                if other_block["attr"]["layer"] != my_layer:
                    edges.add(other_id)
                    
        if edges:
            graph["edges"][bid] = sorted(list(edges))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(graph, f, indent=2, ensure_ascii=False)
        
    print(f"Graph built with {len(graph['nodes'])} nodes to {output_path}")

if __name__ == "__main__":
    main()
