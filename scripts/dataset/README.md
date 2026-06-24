# MMSS Fine-tuning Dataset Pipeline

Подготовка JSONL-датасета для Gemma 4 E2B (Kaggle + Unsloth).

## Быстрый запуск

```bash
cd d:\project
pip install pyyaml
python scripts/dataset/run_pipeline.py
```

## Команды для сборки и валидации датасета

### Полный пайплайн (рекомендуется)
```bash
# Запуск полного пайплайна из mmss-builder
cd d:\project
python scripts/dataset/run_pipeline.py
```

### Поэтапный запуск
```bash
# Шаг 1: Сканирование и инвентаризация
python scripts/dataset/scan_inventory.py

# Шаг 2: Экстракция данных из источников
python -c "from scripts.dataset.extractors import build_all; from scripts.dataset.config import load_config; from pathlib import Path; cfg = load_config(Path.cwd()); build_all(Path.cwd(), cfg)"

# Шаг 3: Экстракция stage4 (raw-dataset, helper_json, etc.)
python -c "from scripts.dataset.extractors_stage4 import build_stage4; from scripts.dataset.config import load_config; from pathlib import Path; cfg = load_config(Path.cwd()); build_stage4(Path.cwd(), cfg)"

# Шаг 4: Сборка JSONL файлов с train/val split
python scripts/dataset/build_jsonl.py

# Шаг 5: Валидация JSONL файлов
python scripts/dataset/validate_jsonl.py
```

### Валидация готового датасета
```bash
# Валидация файлов в prepared папке
cd D:\WORK\CLIENTS\extract\prepare-for-fine-tuning-dataset-kaggle-gemma
python validate_jsonl.py

# Валидация файлов в almost_ready папке
python scripts/dataset/validate_jsonl.py
```

### Исправление проблем с датасетом
```bash
# Если mmss_combined_all.jsonl имеет ошибки, пересоздать его из train/val
cd D:\WORK\CLIENTS\extract\prepare-for-fine-tuning-dataset-kaggle-gemma
python fix_combined_jsonl.py
```

## Этапы пайплайна

| Шаг | Скрипт | Результат |
|-----|--------|-----------|
| 1 | `scan_inventory.py` | Инвентарь 3050+ файлов, дедупликация, таблица готовности |
| 2 | `extractors.py` + `extractors_stage4.py` | JSONL из ядра MMSS + raw-dataset + архив |
| 3 | `build_jsonl.py` | train/val split по 3 категориям |
| 4 | `validate_jsonl.py` | Проверка схемы Gemma `messages` |

### Источники Этапа 4

| Источник | Экстрактор |
|----------|------------|
| `raw-dataset/` (extract) | `extract_from_raw_dataset` |
| `packages/mmss_meta_core_v6.yaml` | `extract_from_meta_yaml` (512 ops) |
| `architectures/*.json` | `extract_from_architectures` |
| `mmss_core/ai/source_files_done/` | `extract_from_source_archive` |
| `helper_mmss_builder.json` | `extract_from_helper_json` |
| `ready-for-dataset/` | `extract_from_ready_for_dataset` |

## Выходные каталоги

**Staging (mmss-builder):**
```
data/fine-tuning/staging/
├── mmss-universal/
├── mmss-sound-craft/
├── categories/
└── mmss_combined_all.jsonl
```

**Целевой (extract):**
```
D:\WORK\CLIENTS\extract\prepare-for-fine-tuning-dataset-kaggle-gemma\ready-for-dataset\almost_ready\
├── mmss-universal/
├── mmss-sound-craft/
└── categories/
```

**Финальный (prepared):**
```
D:\WORK\CLIENTS\extract\prepare-for-fine-tuning-dataset-kaggle-gemma\ready-for-dataset\prepared\
├── mmss_combined_train.jsonl
├── mmss_combined_val.jsonl
└── mmss_combined_all.jsonl
```

## Формат JSONL

```json
{"messages": [
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "model", "content": "..."}
]}
```

## Конфигурация

`scripts/dataset/config.yaml` — пути источников, категории, лимиты.

## Отчёты

```
data/fine-tuning/reports/
├── inventory_latest.json
├── readiness_latest.csv
├── summary_latest.json
└── pipeline_latest.json
```

## Устранение неполадок

### Ошибки валидации JSONL
Если `validate_jsonl.py` находит ошибки:
1. Проверьте формат JSONL - должен быть Gemma chat schema с полем `messages`
2. Убедитесь что все записи имеют поля `role` и `content` в сообщениях
3. Используйте `fix_combined_jsonl.py` для пересоздания комбинированного файла

### Дубликаты в датасете
Пайплайн автоматически удаляет дубликаты на этапе сканирования. Если дубликаты все еще есть:
1. Запустите `scan_inventory.py` для обновления инвентаря
2. Проверьте файл `readiness_latest.csv` для идентификации дубликатов
