import json
import re

content = open('scripts/new-dataset/mmss_v2.json', 'r', encoding='utf-8').read()

# Исправляем True/False/None
content = re.sub(r'\bTrue\b', 'true', content)
content = re.sub(r'\bFalse\b', 'false', content)
content = re.sub(r'\bNone\b', 'null', content)

# Используем стек для нахождения отдельных JSON объектов
stack = []
objects = []
start = -1

for i, char in enumerate(content):
    if char == '{':
        if not stack:
            start = i
        stack.append(char)
    elif char == '}':
        if stack:
            stack.pop()
            if not stack and start != -1:
                objects.append(content[start:i+1])
                start = -1

# Оборачиваем в массив
result = '[\n' + ',\n'.join(objects) + '\n]'

open('scripts/new-dataset/mmss_v2.json', 'w', encoding='utf-8').write(result)
print('Fixed')
