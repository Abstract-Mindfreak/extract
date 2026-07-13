#!/usr/bin/env python3
"""
Проверяет и исправляет невалидные JSON файлы в scripts/new-dataset
"""

import json
import re
from pathlib import Path
from collections import defaultdict

INPUT_DIR = Path("D:/WORK/CLIENTS/extract/scripts/new-dataset")


def is_valid_json(content: str) -> bool:
    """Проверяет валидность JSON."""
    try:
        json.loads(content)
        return True
    except json.JSONDecodeError:
        return False


def fix_multiple_json_objects(content: str) -> str:
    """Исправляет несколько JSON объектов разделенных запятыми - оборачивает в массив."""
    # Проверяем если это несколько объектов разделенных запятыми
    # Удаляем пробелы и переносы в начале и конце
    content = content.strip()
    
    # Если начинается с { и содержит },{ то это несколько объектов
    if content.startswith('{') and '},{' in content:
        # Заменяем },{ на },\n{
        content = content.replace('},{', '},\n{')
        # Оборачиваем в массив
        content = '[\n' + content + '\n]'
        return content
    
    return content


def fix_trailing_commas(content: str) -> str:
    """Удаляет лишние запятые перед закрывающими скобками."""
    # Удаляет запятые перед } и ]
    content = re.sub(r',(\s*[}\]])', r'\1', content)
    return content


def fix_json_comments(content: str) -> str:
    """Удаляет комментарии (не поддерживаются в JSON)."""
    # Однострочные комментарии //
    content = re.sub(r'//.*', '', content)
    # Многострочные комментарии /* */
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    return content


def attempt_fix(content: str) -> str:
    """Пытается исправить невалидный JSON."""
    original = content
    
    # Применяем различные исправления по очереди
    
    # 1. Удаляем комментарии
    content = fix_json_comments(content)
    
    # 2. Исправляем несколько объектов
    content = fix_multiple_json_objects(content)
    
    # 3. Удаляем лишние запятые
    content = fix_trailing_commas(content)
    
    # 4. Исправляем ключи без кавычек (например, Source: вместо "Source":)
    content = re.sub(r'(\w+)\s*:', r'"\1":', content)
    
    # 5. Исправляем одиночные кавычки на двойные
    content = content.replace("'", '"')
    
    # 6. Добавляем недостающие запятые между объектами в массивах
    content = re.sub(r'(\})\s*(\{)', r'\1,\n\2', content)
    
    # 7. Исправляем boolean и null значения
    content = re.sub(r'\bTrue\b', 'true', content)
    content = re.sub(r'\bFalse\b', 'false', content)
    content = re.sub(r'\bNone\b', 'null', content)
    
    return content


def main():
    input_dir = INPUT_DIR
    
    if not input_dir.exists():
        print(f"Ошибка: Папка '{input_dir}' не найдена.")
        return
    
    json_files = list(input_dir.rglob("*.json"))
    
    if not json_files:
        print("JSON файлы не найдены.")
        return
    
    print(f"Найдено JSON файлов: {len(json_files)}")
    print()
    
    valid_count = 0
    invalid_count = 0
    fixed_count = 0
    file_stats = defaultdict(list)
    
    for json_file in json_files:
        try:
            content = json_file.read_text(encoding="utf-8", errors="replace")
            
            if is_valid_json(content):
                valid_count += 1
                file_stats["valid"].append(str(json_file.relative_to(input_dir)))
            else:
                invalid_count += 1
                print(f"Невалидный JSON: {json_file.relative_to(input_dir)}")
                
                # Пытаемся исправить
                fixed_content = attempt_fix(content)
                
                if is_valid_json(fixed_content):
                    # Сохраняем исправленную версию
                    json_file.write_text(fixed_content, encoding="utf-8")
                    fixed_count += 1
                    file_stats["fixed"].append(str(json_file.relative_to(input_dir)))
                    print(f"  ✓ Исправлен")
                else:
                    file_stats["cannot_fix"].append(str(json_file.relative_to(input_dir)))
                    print(f"  ✗ Не удалось исправить")
                print()
                
        except Exception as e:
            print(f"Ошибка при обработке {json_file.name}: {e}")
            file_stats["error"].append(str(json_file.relative_to(input_dir)))
    
    print("=" * 60)
    print("СТАТИСТИКА")
    print("=" * 60)
    print(f"Валидных файлов: {valid_count}")
    print(f"Невалидных файлов: {invalid_count}")
    print(f"Исправлено: {fixed_count}")
    print(f"Не удалось исправить: {len(file_stats['cannot_fix'])}")
    print(f"Ошибки при обработке: {len(file_stats['error'])}")
    print()
    
    if file_stats["fixed"]:
        print("Исправленные файлы:")
        for f in file_stats["fixed"]:
            print(f"  - {f}")
        print()
    
    if file_stats["cannot_fix"]:
        print("Не удалось исправить:")
        for f in file_stats["cannot_fix"]:
            print(f"  - {f}")
        print()
    
    if file_stats["error"]:
        print("Ошибки при обработке:")
        for f in file_stats["error"]:
            print(f"  - {f}")
        print()
    
    print("=" * 60)


if __name__ == "__main__":
    main()
