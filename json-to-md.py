import json
import os
from pathlib import Path

def json_to_markdown(data, depth=1):
    """Recursively converts a JSON dictionary/list into structured Markdown text."""
    md_content = ""
    
    if isinstance(data, dict):
        for key, value in data.items():
            # Use dictionary keys as Markdown headers based on nesting depth
            header_prefix = "#" * min(depth, 6)
            
            if isinstance(value, (dict, list)):
                md_content += f"\n{header_prefix} {key.title()}\n"
                md_content += json_to_markdown(value, depth + 1)
            else:
                # Format flat key-value pairs as bullet points
                md_content += f"* **{key}**: {value}\n"
                
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, (dict, list)):
                md_content += json_to_markdown(item, depth)
                md_content += "\n---\n"  # Divider between list items
            else:
                md_content += f"* {item}\n"
                
    return md_content

def batch_convert_folder(input_folder, output_folder):
    """Reads all .json files in input_folder and outputs .md files to output_folder."""
    input_path = Path(input_folder)
    output_path = Path(output_folder)
    
    # Create the output directory if it doesn't exist
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Find all .json files
    json_files = list(input_path.glob("*.json"))
    
    if not json_files:
        print(f"No .json files found in '{input_folder}'")
        return

    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            
            # Convert JSON structure to Markdown string
            markdown_text = f"# Data from {json_file.name}\n\n"
            markdown_text += json_to_markdown(json_data)
            
            # Save with the same filename but a .md extension
            md_filename = json_file.stem + ".md"
            with open(output_path / md_filename, 'w', encoding='utf-8') as f:
                f.write(markdown_text)
                
            print(f"Converted: {json_file.name} -> {md_filename}")
            
        except Exception as e:
            print(f"Failed to convert {json_file.name}: {e}")

if __name__ == "__main__":
    # Change these paths to match your folder setup
    INPUT_DIR = "D:/WORK/CLIENTS/extract/scripts/extra-data-for-split"
    OUTPUT_DIR = "D:/WORK/CLIENTS/extract/test_pipeline_output/md-converted"
    
    batch_convert_folder(INPUT_DIR, OUTPUT_DIR)
