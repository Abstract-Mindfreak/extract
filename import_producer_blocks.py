import json
import requests

API_URL = "http://localhost:8005/api/music-blocks/"

def import_producer_blocks():
    # Read the producer-ai-base.json file
    with open("prompt-db-local/database/producer-ai-base.json", "r", encoding="utf-8") as f:
        blocks = json.load(f)
    
    print(f"Total blocks to import: {len(blocks)}")
    
    success_count = 0
    error_count = 0
    
    for i, block in enumerate(blocks):
        # Extract metadata from the block
        block_id = block.get("block_id")
        block_name = block.get("block_name", f"Block_{block_id}")
        
        # Determine block type based on content
        block_type = "Unknown"
        if "mmss_logic" in block:
            block_type = "Logic"
        elif "rhythmic_grid" in block or "macro_synthesis_parameters" in block:
            block_type = "Rhythm"
        elif "spectral_merging" in block or "lfe_fusion_parameters" in block:
            block_type = "Space"
        elif "waveform" in block or "filter" in block:
            block_type = "Timbre"
        
        # Extract layer if available
        layer = 1
        if "layer" in block:
            layer = block["layer"]
        
        # Create slug
        slug = f"producer_{block_id}" if block_id else f"producer_block_{i}"
        
        # Create payload
        payload = {
            "block_type": block_type,
            "layer": layer,
            "slug": slug,
            "name": block_name,
            "content": block
        }
        
        # Send to API
        try:
            response = requests.post(API_URL, json=payload)
            if response.status_code in [200, 201]:
                success_count += 1
                print(f"[{i+1}/{len(blocks)}] Success: {block_name}")
            else:
                error_count += 1
                print(f"[{i+1}/{len(blocks)}] Failed: {block_name} - Status: {response.status_code}")
        except Exception as e:
            error_count += 1
            print(f"[{i+1}/{len(blocks)}] Error: {block_name} - {str(e)}")
    
    print(f"\nImport complete: {success_count} successful, {error_count} failed")

if __name__ == "__main__":
    import_producer_blocks()
