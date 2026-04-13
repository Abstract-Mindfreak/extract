import json
import os
import re
import math

def tokenize(text):
    return re.findall(r'\w+', text.lower())

def get_block_text(block):
    text_parts = []
    text_parts.append(str(block.get("id", "")))
    text_parts.append(block.get("meta", {}).get("intent", ""))
    
    # DNA Params keys
    params = block.get("dna", {}).get("params", {})
    text_parts.extend(params.keys())
    
    # Legacy data
    legacy = block.get("legacy", {})
    for k, v in legacy.items():
        text_parts.append(k)
        if isinstance(v, str) and len(v) < 100:
            text_parts.append(v)
            
    return " ".join(text_parts)

def build_sparse_vector(text, idf):
    tokens = tokenize(text)
    tf = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1
        
    vector = {}
    for t, count in tf.items():
        if t in idf:
            vector[t] = count * idf[t]
            
    # Normalize
    norm = math.sqrt(sum(v**2 for v in vector.values()))
    if norm > 0:
        for t in vector:
            vector[t] /= norm
            
    return vector, norm

def cosine_similarity(v1, v2):
    common_terms = set(v1.keys()) & set(v2.keys())
    dot_product = sum(v1[t] * v2[t] for t in common_terms)
    return dot_product

def main():
    blocks_root = os.path.join('database', 'blocks')
    output_path = os.path.join('database', 'system', 'embeddings.json')
    
    all_blocks = {}
    doc_counts = {}
    total_docs = 0

    if not os.path.exists(blocks_root):
        return

    for root, dirs, files in os.walk(blocks_root):
        for file in files:
            if file.endswith('.json'):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    block = json.load(f)
                    bid = block["id"]
                    text = get_block_text(block)
                    all_blocks[bid] = text
                    total_docs += 1
                    tokens = set(tokenize(text))
                    for t in tokens:
                        doc_counts[t] = doc_counts.get(t, 0) + 1

    # Build IDF
    idf = {}
    for t, count in doc_counts.items():
        idf[t] = math.log(total_docs / (1 + count))

    # Build Vectors
    embeddings = {
        "version": "3.0",
        "embedding_type": "local_sparse_semantic",
        "dimensions": len(idf),
        "blocks": {}
    }

    for bid, text in all_blocks.items():
        vector, norm = build_sparse_vector(text, idf)
        embeddings["blocks"][bid] = {
            "vector": vector,
            "norm": norm
        }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(embeddings, f, indent=2, ensure_ascii=False)
        
    print(f"Embeddings built for {total_docs} blocks to {output_path}")

if __name__ == "__main__":
    main()
