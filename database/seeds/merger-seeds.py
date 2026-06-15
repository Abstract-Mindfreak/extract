import json
import glob
import os
from pathlib import Path

def merge_ontology_files():
    # 1. Находим все соответствующие файлы в директории скрипта
    script_dir = Path(__file__).parent
    file_pattern = "mmss_ontology_seed*.json"
    output_filename = script_dir / "mmss_ontology_seed.json"
    files = sorted(script_dir.glob(file_pattern))
    # Исключаем выходной файл из списка
    files = [str(f) for f in files if f != output_filename]
    
    if not files:
        print(f"Ошибка: Файлы по маске '{file_pattern}' не найдены в текущей папке.")
        return

    print(f"Найдено файлов для объединения: {len(files)}")
    for f in files:
        print(f"  - {f}")

    # 2. Инициализируем структуры для хранения объединенных данных
    # Используем словари с ключом operator_id для удобного слияния и удаления дубликатов
    merged_phases = {}
    merged_domains = {}
    
    # Сохраняем порядок operator_id из первого файла
    phase_order = []
    domain_order = []
    
    # Метаданные возьмем из самого первого (базового) файла
    base_metadata = {
        "version": "1.0.2",
        "description": "Merged MMSS ontology seed dictionary.",
        "target_tables": {}
    }

    # 3. Проходим по каждому файлу и сливаем данные
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Сохраняем метаданные только из первого файла
            if file_path == files[0]:
                base_metadata["version"] = data.get("version", base_metadata["version"])
                base_metadata["description"] = data.get("description", base_metadata["description"])
                base_metadata["target_tables"] = data.get("target_tables", base_metadata["target_tables"])

            # Объединяем phase_patterns
            for phase in data.get("phase_patterns", []):
                op_id = phase["operator_id"]
                if op_id not in merged_phases:
                    # Если оператор встречается впервые, копируем его целиком
                    merged_phases[op_id] = phase.copy()
                    # Добавляем в порядок только один раз при первом появлении
                    if op_id not in phase_order:
                        phase_order.append(op_id)
                else:
                    # Если уже существует, расширяем списки и удаляем дубликаты через set
                    existing = merged_phases[op_id]
                    existing["keywords"] = list(set(existing.get("keywords", []) + phase.get("keywords", [])))
                    existing["markers"] = list(set(existing.get("markers", []) + phase.get("markers", [])))
                    # Обновляем notes, если в новом файле они длиннее или содержат новую инфо (опционально)
                    if len(phase.get("notes", "")) > len(existing.get("notes", "")):
                        existing["notes"] = phase["notes"]

            # Объединяем domain_patterns
            for domain in data.get("domain_patterns", []):
                op_id = domain["operator_id"]
                if op_id not in merged_domains:
                    merged_domains[op_id] = domain.copy()
                    # Добавляем в порядок только один раз при первом появлении
                    if op_id not in domain_order:
                        domain_order.append(op_id)
                else:
                    existing = merged_domains[op_id]
                    existing["keywords"] = list(set(existing.get("keywords", []) + domain.get("keywords", [])))
                    existing["markers"] = list(set(existing.get("markers", []) + domain.get("markers", [])))
                    
                    # Объединяем aliases, если они есть
                    if "aliases" in domain:
                        existing_aliases = existing.get("aliases", [])
                        existing["aliases"] = list(set(existing_aliases + domain.get("aliases", [])))

        except json.JSONDecodeError:
            print(f"Предупреждение: Не удалось прочитать JSON из файла {file_path}. Пропускаем.")
        except Exception as e:
            print(f"Ошибка при обработке файла {file_path}: {e}")

    # 4. Преобразуем словари обратно в списки для финального JSON
    # Используем сохраненный порядок из первого файла, новые операторы добавляются в конец
    final_phase_patterns = [merged_phases[k] for k in phase_order if k in merged_phases]
    final_domain_patterns = [merged_domains[k] for k in domain_order if k in merged_domains]

    # Собираем итоговый объект
    final_data = {
        "version": base_metadata["version"],
        "description": base_metadata["description"],
        "target_tables": base_metadata["target_tables"],
        "phase_patterns": final_phase_patterns,
        "domain_patterns": final_domain_patterns
    }

    # 5. Сохраняем результат в новый файл в директории скрипта
    output_filename = script_dir / "mmss_ontology_seed.json"
    try:
        with open(output_filename, 'w', encoding='utf-8') as f:
            # ensure_ascii=False гарантирует, что кириллица сохранится как есть, а не в виде \uXXXX
            # indent=2 делает файл читаемым для человека
            json.dump(final_data, f, indent=2, ensure_ascii=False)
        print(f"\n✅ Успешно! Объединенный файл сохранен как: {output_filename}")
        print(f"Всего phase_patterns: {len(final_phase_patterns)}")
        print(f"Всего domain_patterns: {len(final_domain_patterns)}")
    except Exception as e:
        print(f"\n❌ Ошибка при сохранении файла: {e}")

if __name__ == "__main__":
    merge_ontology_files()