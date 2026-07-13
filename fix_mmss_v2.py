import json
import re

content = open('scripts/new-dataset/mmss_v2.json', 'r', encoding='utf-8').read()

# Исправляем True/False/None
content = re.sub(r'\bTrue\b', 'true', content)
content = re.sub(r'\bFalse\b', 'false', content)
content = re.sub(r'\bNone\b', 'null', content)

# Разделяем на объекты по },{
parts = content.split('},{')

# Восстанавливаем фигурные скобки
objects = []
for i, part in enumerate(parts):
    if i == 0:
        objects.append(part + '}')
    elif i == len(parts) - 1:
        objects.append('{' + part)
    else:
        objects.append('{' + part + '}')

# Оборачиваем в массив
result = '[\n' + ',\n'.join(objects) + '\n]'

open('scripts/new-dataset/mmss_v2.json', 'w', encoding='utf-8').write(result)
print('Fixed')
