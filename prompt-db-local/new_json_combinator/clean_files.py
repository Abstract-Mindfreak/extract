import os
import re

dir = 'd:/WORK/CLIENTS/extract/prompt-db-local/new_json_combinator'

for filename in os.listdir(dir):
    if filename.endswith('.tsx') or filename.endswith('.json'):
        filepath = os.path.join(dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        # Remove line number prefix like "     1→1" or "1→1" at start of lines
        cleaned = re.sub(r'^\s*\d+→\d+\s*', '', content, flags=re.MULTILINE)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(cleaned)
        print(f'Cleaned: {filename}')
