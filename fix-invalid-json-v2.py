#!/usr/bin/env python3
"""
Точное исправление невалидных JSON файлов с детальным анализом ошибок
"""

import json
import re
from pathlib import Path

INPUT_DIR = Path("D:/WORK/CLIENTS/extract/scripts/new-dataset")


def fix_unquoted_keys(content: str) -> str:
    """Исправляет ключи без кавычек в строковых значениях."""
    # Ищет паттерн: "key": value, где value - строка без кавычек
    # Например: "Source": WHO, ICRC, 2025
    lines = content.split('\n')
    fixed_lines = []
    
    for line in lines:
        # Проверяем если есть строка после двоеточия без кавычек
        # Паттерн: "key": unquoted_string
        match = re.search(r'"([^"]+)":\s*([^",\{\[\}][^,\n]*)(,?)$', line)
        if match:
            key = match.group(1)
            value = match.group(2).strip()
            comma = match.group(3)
            # Если значение не выглядит как JSON литерал
            if not re.match(r'^\d+$', value) and value not in ['true', 'false', 'null']:
                # Оборачиваем в кавычки
                line = line.replace(f'"{key}": {value}{comma}', f'"{key}": "{value}"{comma}')
        fixed_lines.append(line)
    
    return '\n'.join(fixed_lines)


def fix_specific_file(file_path: Path) -> bool:
    """Пытается исправить конкретный файл с детальным анализом."""
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
        
        # Пробуем загрузить чтобы увидеть ошибку
        try:
            json.loads(content)
            return True  # Уже валиден
        except json.JSONDecodeError as e:
            print(f"  Ошибка: {e}")
            error_pos = e.pos if hasattr(e, 'pos') else -1
            error_line = e.lineno if hasattr(e, 'lineno') else -1
            print(f"  Позиция: {error_pos}, Строка: {error_line}")
            
            if error_line > 0:
                lines = content.split('\n')
                if error_line <= len(lines):
                    print(f"  Строка с ошибкой: {lines[error_line-1][:100]}")
        
        # Применяем исправления
        fixed = content
        
        # 1. Исправляем ключи без кавычек в строковых значениях
        fixed = fix_unquoted_keys(fixed)
        
        # 2. Удаляем комментарии
        fixed = re.sub(r'//.*', '', fixed)
        fixed = re.sub(r'/\*.*?\*/', '', fixed, flags=re.DOTALL)
        
        # 3. Удаляем лишние запятые
        fixed = re.sub(r',(\s*[}\]])', r'\1', fixed)
        
        # 4. Исправляем несколько объектов
        if fixed.startswith('{') and '},{' in fixed:
            fixed = fixed.replace('},{', '},\n{')
            fixed = '[\n' + fixed + '\n]'
        
        # Проверяем результат
        try:
            json.loads(fixed)
            file_path.write_text(fixed, encoding="utf-8")
            print(f"  ✓ Исправлен")
            return True
        except json.JSONDecodeError as e2:
            print(f"  ✗ После исправления: {e2}")
            return False
            
    except Exception as e:
        print(f"  Ошибка при обработке: {e}")
        return False


def main():
    input_dir = INPUT_DIR
    
    if not input_dir.exists():
        print(f"Ошибка: Папка '{input_dir}' не найдена.")
        return
    
    # Список невалидных файлов из предыдущего запуска
    invalid_files = [
        "data.json",
        "FLOOPNEW.json",
        "mmss.json",
        "mmss_v2.json",
        "RAW_DATA/newmmcc.json",
        "NEW-DATABASE-MMSS/RAW_DATA/88.json",
        "NEW-DATABASE-MMSS/RAW_DATA/новый 169.json",
        "NEW-DATABASE-MMSS/RAW_DATA/новый 199.json",
        "NEW-DATABASE-MMSS/RAW_DATA/новый 41.json",
        "music/MMSS-flowmusic-blocks/mmss_reference_updated.json",
        "music/MMSS-flowmusic-blocks/Qwen_json_20260412_rgv48as97.json",
        "music/MMSS-flowmusic-blocks/Qwen_json_20260613_lx50nfvir.json",
        "3-Resources/Theory/MMSS_CORE_ARCHITECTURAL_AND_META_FORMULA_SPECIFICATION_v6.json",
        "3-Resources/Theory/MMSS_META_FORMULAS_FRACTAL_V5_APPLICATIONS_v1.json",
        "3-Resources/Theory/MMSS_QUANTUM_GEOMETRIC_UNIFICATION_SPECIFICATION_v1.json",
        "3-Resources/Theory/MMSS_UNIFIED_ARCHITECTURAL_BLOCK_V2_SELF_EVOLVING_SYSTEM_v1.json",
        "2-Areas/AMMS-KB/mmss-formulas-legacy.json",
        "2-Areas/AMMS-Systems/MMSS_ASTROSYNTHOS_SPECIFICATION_v1.json",
        "2-Areas/AMMS-Systems/MMSS_META_FRACTAL_CRAFT_PACKAGE_V6_COMPLETE.json",
        "2-Areas/AMMS-Systems/QGU-AMMS/Json-data/second-mmss.json",
    ]
    
    fixed_count = 0
    cannot_fix_count = 0
    
    for file_name in invalid_files:
        file_path = input_dir / file_name
        if not file_path.exists():
            print(f"Файл не найден: {file_name}")
            continue
        
        print(f"\nОбработка: {file_name}")
        if fix_specific_file(file_path):
            fixed_count += 1
        else:
            cannot_fix_count += 1
    
    print("\n" + "=" * 60)
    print(f"Исправлено: {fixed_count}")
    print(f"Не удалось исправить: {cannot_fix_count}")
    print("=" * 60)


if __name__ == "__main__":
    main()
