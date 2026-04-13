# Prompt DB Local / Prompt БД Local

## Полный пайплайн эволюции JSON и архитектура MMSS

**Prompt DB Local** — это локальное Electron + React приложение для полного цикла эволюции JSON-данных: от импорта через WebSocket до финальной генерации экспортов с использованием Python-алгоритмов MMSS (Mutation | Model | Semantic | Strategy / Meta-Meta-System-Synthesis).

---

## Архитектура системы

### Обзор пайплайна эволюции

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           ПОЛНЫЙ ЦИКЛ ЭВОЛЮЦИИ JSON                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  [1] IMPORT & SYNC          [2] SCAN & REGISTRY        [3] PYTHON MMSS V3          │
│  ┌──────────────┐          ┌──────────────┐           ┌──────────────────┐          │
│  │ WebSocket    │  ───>   │ Tag Scanner  │  ───>     │ Transform Blocks │          │
│  │ HTTP API     │         │ Key Sequences│           │ Indexer V3       │          │
│  │ Extension    │         │ Registry     │           │ Mutation Engine  │          │
│  └──────────────┘         └──────────────┘           │ Crossover Engine │          │
│          │                      │                     │ Builder V3       │          │
│          ▼                      ▼                     └──────────────────┘          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│                              [4] EXPORT COMPOSER                                 │
│                              ┌──────────────────┐                                │  │
│                              │ Filter by Tags   │                                │  │
│                              │ Pattern Builder  │                                │  │
│                              │ Sequence-Based   │                                │  │
│                              │ File Generation  │                                │  │
│                              └──────────────────┘                                │  │
│                                         │                                        │  │
│                                         ▼                                        │  │
│                              ┌──────────────────┐                                │  │
│                              │ Final JSON Files │                                │  │
│                              └──────────────────┘                                │  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Система 1: Импорт и синхронизация [Trace 1]

### WebSocket Import Pipeline [1a-1e]

**Путь данных:** Chrome Extension → WebSocket → Electron Main → React Renderer → IndexedDB

#### Ключевые узлы:

| Location | Файл | Строка | Описание |
|----------|------|--------|----------|
| **1a** | `electron/main.ts:68` | Запуск WebSocket сервера на порту 3001 |
| **1b** | `electron/main.ts:79` | Создание конверта с JSON и источником |
| **1c** | `electron/main.ts:44` | IPC сообщение в renderer процесс |
| **1d** | `renderer/src/App.tsx:44` | React компонент подписывается на импорты |
| **1e** | `renderer/src/App.tsx:45` | Сохранение в IndexedDB через Dexie |

#### Двойной канал синхронизации:

```
Chrome Extension
├── ws://127.0.0.1:3001  (WebSocket для raw payload)
└── http://127.0.0.1:3210 (HTTP API для generateBatch, promptUsage)
```

#### Структура ImportEnvelope:

```typescript
{
  id: string;           // UUID импорта
  rawJson: string;      // Сырые JSON данные
  source: string;       // Источник (producer.ai, file, ws-client)
  receivedAt: string;   // ISO timestamp
}
```

---

## Система 2: Сканирование тегов и реестр [Trace 2]

### Tag & Key Explorer Pipeline [2a-2e]

**Цель:** Автоматический анализ JSON структуры и создание глобального реестра тегов.

#### Ключевые узлы:

| Location | Файл | Строка | Описание |
|----------|------|--------|----------|
| **2a** | `TagKeyExplorer.tsx:59` | Запуск сканирования БД |
| **2b** | `tagScanner.ts:131` | Рекурсивный обход JSON структуры |
| **2c** | `TagKeyExplorer.tsx:68` | Создание начального реестра тегов |
| **2d** | `TagKeyExplorer.tsx:124` | Применение тегов к элементам БД |
| **2e** | `TagKeyExplorer.tsx:126` | Сохранение в meta store |

#### Алгоритм сканирования:

1. **scanTagsAndKeys()** — рекурсивный обход всех JSON объектов
2. **Frequency Map** — подсчет частоты ключей и значений
3. **Normalization** — нормализация коротких значений
4. **Semantic Seeding** — добавление семантических тегов
5. **Binding Engine** — привязка тегов к элементам

#### Типы тегов:

```typescript
type Tag = {
  id: string;
  label: string;
  color: string;
  type: 'key' | 'value' | 'semantic';
};
```

---

## Система 3: Python MMSS V3 Pipeline [Trace 3]

### Полный цикл Python-трансформации [3a-3f]

**Цель:** Генерация новых алгоритмов через эволюцию блоков с применением MMSS-логики.

#### Ключевые узлы:

| Location | Файл | Строка | Описание |
|----------|------|--------|----------|
| **3a** | `transform_blocks.py:50` | Нормализация producer.ai JSON |
| **3b** | `transform_blocks.py:53` | Определение домена и слоя |
| **3c** | `indexer_v3.py:86` | Построение индекса с метаданными |
| **3d** | `mutation_engine.py:55` | Создание вариаций блоков |
| **3e** | `builder_v3.py:119` | Семантическая оценка релевантности |
| **3f** | `MMSSRuntimeService.ts:71` | Вызов Python из Electron |

#### Архитектура MMSS V3:

```python
# Модули системы:
system/
├── transform_blocks.py      # Трансформация исходных блоков
├── indexer_v3.py          # Индексация для быстрого поиска
├── mutation_engine.py     # Генетические операции (мутация)
├── crossover_engine.py     # Генетические операции (скрещивание)
├── builder_v3.py          # Семантический поиск и сборка
├── rule_engine.py         # Правила композиции
├── self_rule_engine.py    # Самоэволюция правил
├── memory_v3.py           # Память успешных комбинаций
├── embeddings.py          # Векторные представления
└── graph_v3.py            # Граф связей между блоками
```

#### Скоринг блоков (builder_v3.py:27-42):

```python
score = (
    priority * 0.3 +           # Приоритет блока
    confidence * 0.2 +         # Уверенность
    semantic_score * 0.4 +     # Семантическое соответствие
    memory_score * 0.1         # Исторический успех
)
```

---

## Система 4: Композитор экспортов [Trace 4]

### Export Generation Pipeline [4a-4f]

**Цель:** Сборка финальных JSON на основе тегов, последовательностей и пресетов.

#### Ключевые узлы:

| Location | Файл | Строка | Описание |
|----------|------|--------|----------|
| **4a** | `ExportPanel.tsx:150` | Запуск генерации экспорта |
| **4b** | `exportComposer.ts:271` | Фильтрация по тегам и ключам |
| **4c** | `exportComposer.ts:294` | Сборка по последовательностям |
| **4d** | `exportComposer.ts:201` | Выбор с режимом рандомизации |
| **4e** | `exportComposer.ts:207` | Сборка финального JSON |
| **4f** | `main.ts:251` | Запись файлов в файловую систему |

#### Режимы композиции:

```typescript
composition: {
  mode: 'as-is'           // Прямой экспорт без изменений
      | 'random-mix'      // Случайное смешивание элементов
      | 'sequence-based'  // На основе последовательностей ключей
      | 'mmss-v3'         // Использование MMSS V3 builder
      | 'rule-engine'     // Генерация на основе правил
      | 'self-rule-engine'// Самоэволюция правил
      | 'mutation-engine' // Генерация на основе мутаций
      | 'mmss-v4'         // Расширенная версия MMSS
      | 'F-Final';        // Финальная версия алгоритма
}
```

---

## Расширенная архитектура: Новые режимы генерации (из meta.ts:55-68)

### Внедрение новых способов генерации композиции

Комментарии в `meta.ts` (строки 55-68) описывают план внедрения:

```typescript
// 1. rule-engine - генерация композиции на основе правил
// 2. self-rule-engine - генерация на основе self-rule-engine
// 3. mutation-engine - генерация на основе mutation-engine
// 4. Мутация и построение правил для алгоритмов по созданию алгоритмов самоэволюции
```

### Алгоритмы, создающие сами себя (meta.ts:68)

**MMSS логика** — это не точка, а процесс создания алгоритмов, которые:
1. Создают сами себя через мутацию и скрещивание
2. Выявляют лучшие варианты на основе скоринга
3. Формируют правила для будущих генераций
4. Эволюционируют через мета-обучение

```
┌─────────────────────────────────────────────────────────────────┐
│                    MMSS ЭВОЛЮЦИЯ АЛГОРИТМОВ                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────┐    ┌───────────┐    ┌───────────┐               │
│  │  Блоки    │───>│  Мутация  │───>│  Скоринг  │               │
│  │  (seed)   │    │  (engine) │    │  (V3)     │               │
│  └───────────┘    └───────────┘    └─────┬─────┘               │
│         ^                                  │                    │
│         │                                  ▼                    │
│  ┌──────┴────┐                      ┌───────────┐               │
│  │  Memory   │<─────────────────────│  Лучшие   │               │
│  │  (успех)  │                      │  варианты │               │
│  └───────────┘                      └─────┬─────┘               │
│                                         │                      │
│                                         ▼                      │
│                               ┌──────────────────┐             │
│                               │  Self-Rule       │             │
│                               │  Engine          │             │
│                               │  (правила для    │             │
│                               │   новых алгоритмов)│           │
│                               └────────┬─────────┘             │
│                                        │                       │
│                                        ▼                       │
│                               ┌──────────────────┐             │
│                               │  Новые алгоритмы │             │
│                               │  генерации       │             │
│                               └──────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Синхронизация базы данных, UI и Python логики

### Трехуровневая архитектура синхронизации

```
┌─────────────────────────────────────────────────────────────────┐
│                        УРОВЕНЬ 1: UI                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ React State │  │ Zustand     │  │ Компоненты:             │ │
│  │ (local)     │  │ Store       │  │ - TagKeyExplorer        │ │
│  │             │  │ (global)    │  │ - ExportPanel           │ │
│  └──────┬──────┘  └──────┬──────┘  │ - MMSSRuntimePanel      │ │
│         │                │         │ - SequencePresetsPanel  │ │
│         └────────────────┘         └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ IPC (Electron)
┌─────────────────────────────────────────────────────────────────┐
│                      УРОВЕНЬ 2: MAIN PROCESS                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ WebSocket   │  │ HTTP API    │  │ Meta Store              │ │
│  │ Server      │  │ Server      │  │ (filesystem)              │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ spawn
┌─────────────────────────────────────────────────────────────────┐
│                      УРОВЕНЬ 3: PYTHON LAYER                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Transform   │  │ Indexer     │  │ Builder V3              │ │
│  │ Blocks      │  │ V3          │  │ (семантический поиск)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Mutation    │  │ Crossover   │  │ Rule Engine             │ │
│  │ Engine      │  │ Engine      │  │ (валидация)             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Self Rules  │  │ Memory V3   │  │ Embeddings              │ │
│  │ (эволюция)  │  │ (обучение)  │  │ (векторы)               │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Процесс синхронизации тегов через Python

```typescript
// 1. UI запускает сканирование
const handleScan = () => {
  const scanResult = scanTagsAndKeys(elements);  // JS layer
  // ... обработка в UI
}

// 2. Python может расширить теги через семантический анализ
const runPythonTagAnalysis = async () => {
  const result = await MMSSRuntimeService.runEmbeddings();
  // Результат обогащает tag registry
}

// 3. Синхронизация через IPC
await onPersist(localRegistry, nextBindings);
// Сохраняет в .prompt-db-meta/tag-registry.json
```

---

## Технический стек

### Frontend
- **React 19** — UI компоненты
- **TypeScript** — типизация
- **Vite** — сборка
- **Zustand** — состояние приложения
- **Dexie** — IndexedDB wrapper

### Backend (Main Process)
- **Electron** — desktop framework
- **WebSocket (ws)** — real-time communication
- **Node.js HTTP** — API server
- **fs/promises** — файловая система

### Python Layer
- **JSON** — обработка данных
- **re** — токенизация
- **math/random** — алгоритмы генерации
- **argparse** — CLI interface

---

## Структура проекта

```
prompt-db-local/
├── electron/                       # Main process
│   ├── main.ts                    # Entry point, WebSocket, IPC
│   ├── httpApi.ts                 # HTTP API server
│   ├── preload.ts                 # Bridge API
│   └── metaStore.ts               # Файловое хранилище метаданных
├── renderer/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TagKeyExplorer.tsx    # Сканирование тегов [2a-2e]
│   │   │   ├── SequencePresetsPanel.tsx # Последовательности
│   │   │   ├── ExportPanel.tsx       # Композитор экспортов [4a-4f]
│   │   │   ├── MMSSRuntimePanel.tsx  # Python интеграция [3f]
│   │   │   ├── ImportPanel.tsx       # Импорт [1d-1e]
│   │   │   ├── PromptList.tsx        # Список промптов
│   │   │   └── PromptEditor.tsx      # Редактор
│   │   ├── utils/
│   │   │   ├── tagScanner.ts         # Сканер [2b]
│   │   │   ├── tagRegistry.ts        # Реестр тегов [2c-2d]
│   │   │   ├── keySequenceEngine.ts  # Последовательности
│   │   │   ├── exportComposer.ts     # Композитор [4b-4e]
│   │   │   └── MMSSRuntimeService.ts # Python bridge [3f]
│   │   ├── types/
│   │   │   ├── meta.ts               # Типы метаданных (строка 55+)
│   │   │   └── prompt.ts             # Типы промптов
│   │   ├── db/
│   │   │   └── promptsDb.ts          # IndexedDB [1e]
│   │   └── App.tsx                   # Главный компонент
├── system/                          # Python модули [3a-3e]
│   ├── transform_blocks.py
│   ├── indexer_v3.py
│   ├── builder_v3.py
│   ├── mutation_engine.py
│   ├── crossover_engine.py
│   ├── rule_engine.py
│   ├── self_rule_engine.py
│   ├── memory_v3.py
│   ├── embeddings.py
│   └── graph_v3.py
├── extension/                       # Chrome Extension
│   ├── background.js
│   ├── content.js
│   └── manifest.json
└── database/                        # Локальные данные
    ├── blocks/                      # Трансформированные блоки
    └── system/                      # Индексы и embeddings
```

---

## Режимы композиции и их эволюция

### Текущие режимы (meta.ts:71)

| Режим | Описание | Использование |
|-------|----------|---------------|
| `as-is` | Прямой экспорт | Быстрый дамп данных |
| `random-mix` | Случайное смешивание | Тестовые наборы |
| `sequence-based` | На основе ключей | Структурированный экспорт |
| `mmss-v3` | Семантический поиск | Интеллектуальная сборка |

### Планируемые режимы (meta.ts:65-68)

| Режим | Python модуль | Описание |
|-------|---------------|----------|
| `rule-engine` | `rule_engine.py` | Генерация на основе правил |
| `self-rule-engine` | `self_rule_engine.py` | Самоэволюция правил |
| `mutation-engine` | `mutation_engine.py` | Генерация через мутации |
| `mmss-v4` | `builder_v3.py` | Расширенная версия |
| `F-Final` | - | Финальная версия алгоритма |

### Реализация новых режимов

```typescript
// 1. Добавить mode в meta.ts (строка 71)
mode: 'as-is' | 'random-mix' | ... | 'rule-engine' | 'self-rule-engine';

// 2. Реализовать в exportComposer.ts
if (compositionMode === 'rule-engine') {
  return buildRuleEngineItem(filtered, exportPreset);
}

// 3. Добавить Python обработчик в builder_v3.py
elif composition_mode == 'rule-engine':
    result = rule_engine.build_with_rules(config)
```

---

## Разработка

### Установка

```bash
npm install
```

### Режим разработки

```bash
npm run dev
```

### Сборка

```bash
npm run build
npm start
```

---

## Лицензия

MIT License
