import os
import json
from pathlib import Path

# --- НАСТРОЙКИ ---
INPUT_FOLDER = "D:/WORK/CLIENTS/extract/scripts/extra-data-for-split"   # Папка с исходными .json файлами
OUTPUT_FOLDER = "D:/WORK/CLIENTS/extract/test_pipeline_output/md-converted2"   # Папка для сохранения готовых .md файлов

def json_to_markdown(data):
    """Преобразует JSON-данные в форматированный текст Markdown."""
    markdown_lines = []
    
    # Если на входе словарь (один объект)
    if isinstance(data, dict):
        for key, value in data.items():
            # Делаем ключи заголовками для структуры Markdown
            title = key.replace("_", " ").capitalize()
            markdown_lines.append(f"## {title}\n")
            
            if isinstance(value, (dict, list)):
                markdown_lines.append(f"```json\n{json.dumps(value, ensure_ascii=False, indent=2)}\n```\n")
            else:
                markdown_lines.append(f"{value}\n")
                
    # Если на входе список объектов
    elif isinstance(data, list):
        for idx, item in enumerate(data):
            markdown_lines.append(f"# Item {idx + 1}\n")
            markdown_lines.append(json_to_markdown(item))
            markdown_lines.append("\n---\n")
            
    else:
        markdown_lines.append(str(data))
        
    return "\n".join(markdown_lines)

def process_directory():
    # Создаем выходную папку, если её нет
    Path(OUTPUT_FOLDER).mkdir(parents=True, exist_ok=True)
    
    json_folder = Path(INPUT_FOLDER)
    if not json_folder.exists():
        print(f"Ошибка: Исходная папка '{INPUT_FOLDER}' не найдена.")
        return

    # Ищем все .json файлы в папке
    json_files = list(json_folder.glob("*.json"))
    
    if not json_files:
        print("В папке не найдено .json файлов.")
        return

    print(f"Найдено файлов для конвертации: {len(json_files)}")

    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                content = json.load(f)
            
            # Генерируем Markdown контент
            md_content = json_to_markdown(content)
            
            # Формируем имя нового файла
            md_filename = json_file.stem + ".md"
            output_path = Path(OUTPUT_FOLDER) / md_filename
            
            # Сохраняем результат
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
                
            print(f"Успешно сконвертирован: {json_file.name} -> {md_filename}")
            
        except Exception as e:
            print(f"Ошибка при обработке файла {json_file.name}: {e}")

if __name__ == "__main__":
    process_directory()
