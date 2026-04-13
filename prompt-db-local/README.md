# Prompt DB Local

`Prompt DB Local` — локальное Electron + React приложение для импорта JSON-пакетов с промтами, хранения библиотеки блоков, тегирования, извлечения последовательностей ключей, генерации экспортов и связи с Chrome extension для `producer.ai`.

Этот README описывает:

- что приложение уже умеет;
- текущее техническое состояние;
- что в нем стоит улучшить;
- как внедрить Mistral как координирующий слой для генерации промтов и правил.

## Краткий вывод

Проект уже выглядит как хорошая основа для локальной prompt-lab системы:

- есть Electron main process;
- есть React UI;
- есть локальная IndexedDB через Dexie;
- есть Chrome extension;
- есть Python-слой для MMSS / mutation / rule engine;
- есть начальная интеграция с Mistral API;
- есть session-tracking между extension и приложением.

Но в текущем виде Mistral пока используется скорее как прямой AI-вызов, а не как полноценный orchestration-layer. Главная следующая задача — превратить его в слой планирования, валидации, критики и обратной связи между UI, локальной базой, rule-engine и Python-пайплайном.

## Проверенное текущее состояние

Проверено в рабочем окружении `10 апреля 2026`.

### Что подтверждено

- `npm test` проходит: `13/13` тестов успешно.
- Приложение имеет рабочую базовую архитектуру: Electron + React/Vite + Dexie + Chrome extension + Python scripts.
- В Electron уже есть IPC для:
  - импорта файлов;
  - WebSocket-синхронизации;
  - HTTP API для extension;
  - запуска Python-скриптов;
  - вызова Mistral API.

### Что сейчас сломано

`npm run build` падает.

Основные причины:

- рассинхрон типов между:
  - `renderer/src/types/meta.ts`
  - `renderer/src/vite-env.d.ts`
  - `electron/metaStore.ts`
- дублирующая декларация `window.electronAPI` в `renderer/src/utils/MMSSRuntimeService.ts`
- в renderer уже объявлены расширенные composition modes (`rule-engine`, `self-rule-engine`, `mutation-engine`, `mmss-v4`, `Φ_total`), но preload/main/meta-store еще живут в более старом контракте;
- есть неиспользуемые переменные и импорты, которые валят строгую TypeScript-сборку;
- в ряде файлов заметна проблема с кодировкой текста и комментариев.

## Что уже реализовано

### Импорт и хранение

- Импорт JSON из файлов.
- Импорт из Chrome extension через `ws://127.0.0.1:3001`.
- Локальное хранилище промтов в IndexedDB через Dexie.
- Снимок промтов и метаданные в `.prompt-db-meta` через Electron.

### Аналитика и подготовка

- Сканирование ключей и значений.
- Формирование tag registry.
- Привязка тегов к элементам.
- Извлечение key-sequence presets.
- Создание export presets.

### Генерация и экспорт

- Экспорт в режимах:
  - `as-is`
  - `random-mix`
  - `sequence-based`
- HTTP API для extension:
  - `/api/health`
  - `/api/exportPresets`
  - `/api/generateBatch`
  - `/api/promptUsage`

### Python / MMSS

- Запуск Python-задач из Electron:
  - `transform_blocks.py`
  - `system/indexer_v3.py`
  - `system/embedding_builder.py`
  - `system/graph_builder_v3.py`
  - `system/mutation_engine.py`
  - `system/crossover_engine.py`
  - `system/self_rule_engine.py`
  - `system/builder_v3.py`

### Session intelligence

- Extension отправляет `sessionContext` вместе с WebSocket payload.
- В renderer есть `SessionStateManager`.
- Есть UI-панели для AI sessions и Mistral chat.
- Есть заготовка для autobatch-анализа.

## Архитектура проекта

### Слои

1. `extension/`
   Chrome extension для `producer.ai`, генерации batch, вставки промтов, отслеживания usage и отправки session context.

2. `electron/`
   Main process, preload bridge, HTTP API, WebSocket server, работа с файлами и запуск Python.

3. `renderer/`
   React UI, Dexie, Zustand, панели импорта, тегирования, sequences, export, session intelligence.

4. `system/`
   Python-скрипты для индексации, правил, мутаций, графа и сборки.

5. `database/`
   Локальная база блоков и системные артефакты генерации.

### Фактический pipeline

`producer.ai / file import`  
→ `Electron WebSocket / file dialog`  
→ `renderer store + Dexie`  
→ `tag scan / sequence extraction / export presets`  
→ `exportComposer или Python runtime`  
→ `extension / JSON export / session feedback`

## Основные проблемы и что улучшить

### 1. Нужен единый контракт типов

Сейчас проект держит похожие, но разные описания метаданных сразу в нескольких местах. Из-за этого renderer думает, что режимов композиции много, а Electron/meta-store считают, что их только три.

Что сделать:

- вынести общие типы в `shared/` модуль;
- использовать один `ExportPreset`, один `PromptDbMetaState`, один `electronAPI` contract;
- убрать локальные дубликаты типов из `vite-env.d.ts` и `metaStore.ts`.

### 2. Нужна стабилизация сборки

Сейчас тесты проходят, но сборка не проходит. Это означает, что проект частично поддерживается, но не находится в действительно release-ready состоянии.

Что сделать:

- исправить type drift;
- убрать дубли объявления `window.electronAPI`;
- синхронизировать `preload.ts` и renderer types;
- убрать неиспользуемые импорты/переменные.

### 3. Mistral пока не является orchestration-layer

Сейчас Mistral вызывается напрямую через IPC (`mistral:chat`, `mistral:apply-phi`), а затем ответ грубо парсится строками. Это хрупко и плохо масштабируется.

Что сделать:

- перейти на строго структурированные JSON-ответы;
- ввести schema validation перед применением результата;
- разделить роли Mistral на planner / rule-generator / critic / summarizer;
- не давать UI напрямую решать, как интерпретировать ответ модели.

### 4. Состояние сессий хранится слишком локально

`SessionStateManager` хранит данные в `localStorage` renderer-процесса. Это неудобно для долгоживущих сценариев, отладки, экспорта, многократных окон и воспроизводимости.

Что сделать:

- перенести session storage в Electron meta-store;
- хранить session history, summaries, rules, outcomes в JSON-файлах или отдельной локальной БД;
- сделать session analysis воспроизводимым.

### 5. Есть проблемы с кодировкой и UX-согласованностью

В части файлов текст и комментарии повреждены кодировкой, а UI-панели смешивают разные стили и inline CSS.

Что сделать:

- нормализовать кодировку файлов в UTF-8;
- убрать визуальный разнобой;
- вынести inline-styles в общую систему стилей;
- привести AI/session UI к общему визуальному языку приложения.

### 6. Extension завязан на хрупкие DOM-селекторы

Для `producer.ai` это риск: любое изменение DOM на стороне сайта может сломать вставку промтов и extraction flow.

Что сделать:

- централизовать селекторы;
- добавить fallback-стратегии;
- логировать качество определения `sessionName` и textarea;
- добавить health-check для extension integration.

### 7. Нет формального цикла оценки качества генерации

Python-генерация, export и session intelligence уже есть, но пока нет единого feedback loop:

- что сработало;
- какие правила были полезны;
- какой набор промтов дал лучший результат;
- какие стратегии лучше для конкретного intent.

Что сделать:

- сохранять `intent -> rules -> output -> score`;
- добавить critic-step;
- копить memory успешных и неуспешных генераций.

### 8. Смешаны runtime-данные и проектные данные

В рабочем дереве видны измененные/generated JSON-файлы в `database/system/generated_blocks`. Это полезно для локальной эволюции, но мешает контролю версий и анализу состояния проекта.

Что сделать:

- отделить source data от generated artifacts;
- часть generated output хранить в отдельной рабочей папке;
- добавить `.gitignore`/политику сохранения.

## Какой должна быть роль Mistral

Mistral не должен быть просто "чатом над приложением". Его правильная роль здесь:

- понимать intent пользователя;
- предлагать стратегию генерации;
- собирать правила для `rule-engine`;
- выбирать режим композиции;
- критиковать результат;
- суммировать session history;
- формировать следующий шаг пайплайна.

Иными словами, Mistral здесь должен быть не `generator-only`, а `planner + coordinator + critic`.

## Целевая архитектура Mistral слоя

### Основная идея

Вместо:

`UI -> direct Mistral call -> raw text -> try to parse -> apply`

нужно:

`UI -> Coordinator -> Context Builder -> Mistral Planner -> Schema Validator -> Rule Compiler -> Executor -> Critic -> Memory`

### Предлагаемые роли Mistral

1. `Intent Planner`
   Получает user intent, текущую библиотеку, доступные домены, слои, теги, session context и возвращает structured generation plan.

2. `Rule Generator`
   Создает `RuleSet` для `rule-engine` и `self-rule-engine`.

3. `Prompt Composer`
   Готовит scaffold промта или системного шаблона для генерации.

4. `Critic / Evaluator`
   Анализирует результат экспорта или Python generation и дает рекомендации.

5. `Session Summarizer`
   Делает сводку по Producer AI session и предлагает следующий шаг.

## Как внедрить Mistral слой в этот проект

### Шаг 1. Сначала выровнять контракты

Перед любым расширением Mistral нужно исправить базовую рассинхронизацию типов.

Обязательно синхронизировать:

- `renderer/src/types/meta.ts`
- `renderer/src/vite-env.d.ts`
- `electron/preload.ts`
- `electron/metaStore.ts`
- `renderer/src/utils/MMSSRuntimeService.ts`

Цель:

- один набор типов;
- один контракт `electronAPI`;
- один список composition modes;
- один формат `RuleSet`.

### Шаг 2. Вынести Mistral orchestration в отдельный сервис Electron

Лучше всего добавить новый модуль, например:

`electron/services/mistralCoordinator.ts`

Он должен инкапсулировать:

- вызов Mistral API;
- timeouts и retries;
- выбор модели;
- JSON schema validation;
- redaction чувствительных данных;
- лимиты на токены;
- fallback-стратегии.

Пример будущего API:

```ts
type GenerationPlan = {
  intent: string;
  recommendedMode:
    | 'as-is'
    | 'random-mix'
    | 'sequence-based'
    | 'rule-engine'
    | 'self-rule-engine'
    | 'mutation-engine'
    | 'mmss-v3';
  domains: string[];
  layers: number[];
  rules: {
    composition_rules: Array<{
      name: string;
      logic: 'must_include_layers' | 'min_domains' | 'conditional_requirement';
      value?: number[] | number;
      if?: Record<string, unknown>;
      then?: Record<string, unknown>;
    }>;
  };
  rationale: string[];
};
```

### Шаг 3. Собирать контекст для Mistral не из UI, а из системы

Перед вызовом Mistral нужно формировать context packet:

- активный intent;
- session summary;
- доступные домены (`Rhythm`, `Timbre`, `Space`, `Logic`);
- доступные слои;
- теги и sequence presets;
- статистику прошлых успешных генераций;
- выбранный export preset;
- ограничения по размеру/количеству/режиму.

Это должен делать `Context Builder`, а не UI-компонент вручную.

### Шаг 4. Использовать structured output и schema validation

Сейчас часть логики основана на парсинге произвольного текста. Это нужно заменить на строгие JSON-ответы.

Пример ожидаемого ответа от Mistral:

```json
{
  "intent": "industrial hypnotic groove",
  "recommendedMode": "rule-engine",
  "domains": ["Rhythm", "Timbre", "Space"],
  "layers": [1, 2, 3],
  "rules": {
    "composition_rules": [
      {
        "name": "layer_balance",
        "logic": "must_include_layers",
        "value": [1, 2, 3]
      },
      {
        "name": "domain_spread",
        "logic": "min_domains",
        "value": 3
      }
    ]
  },
  "rationale": [
    "Intent requires rhythmic foundation",
    "Need spatial variation",
    "Three domains are enough for cohesion"
  ]
}
```

Если JSON невалиден:

- ничего автоматически не применять;
- показывать ошибку в UI;
- использовать безопасный fallback preset.

### Шаг 5. Встроить Mistral в export flow

Лучшие точки интеграции:

- `renderer/src/components/ExportPanel.tsx`
- `renderer/src/components/MMSSRuntimePanel.tsx`
- `renderer/src/components/SessionPanel.tsx`

Что добавить:

- кнопка `Generate Rules with Mistral`;
- кнопка `Plan Generation`;
- кнопка `Critique Current Export`;
- режим `Apply Suggested Preset`.

UI не должен напрямую строить правила. Он должен лишь:

- запросить plan;
- показать его;
- дать подтвердить;
- запустить executor.

### Шаг 6. Завязать Mistral на Python engines

После получения validated plan:

- если `recommendedMode = rule-engine`, запускать `system/rule_engine.py`;
- если `recommendedMode = self-rule-engine`, запускать `system/self_rule_engine.py`;
- если `recommendedMode = mutation-engine`, запускать `system/mutation_engine.py`;
- если нужен MMSS build, запускать `system/builder_v3.py`.

Важно:

- Mistral предлагает стратегию;
- Python исполняет стратегию;
- приложение валидирует и сохраняет результат.

### Шаг 7. Добавить critic loop

После генерации нужно запускать второй Mistral-проход:

- анализ результата;
- выявление слабых мест;
- рекомендации по следующей итерации;
- запись summary и score в memory.

Минимальная форма:

```ts
type CritiqueResult = {
  strengths: string[];
  weaknesses: string[];
  nextAdjustments: string[];
  estimatedQuality: number;
};
```

### Шаг 8. Сделать память по intent и правилам

Нужна локальная память для координации:

- какие rule sets уже применялись;
- какие intents были успешны;
- какие домены часто выбирались;
- какие session patterns повторяются;
- какие рекомендации Mistral реально дали хороший output.

Можно хранить это в:

- `database/system/mistral_memory.json`
- или в отдельном meta-файле рядом с `.prompt-db-meta`

## Рекомендуемый roadmap внедрения

### Phase 1. Foundation

- Починить build.
- Убрать type drift.
- Ввести `shared` contracts.
- Нормализовать кодировку и текст.
- Сделать единый `electronAPI` тип.

### Phase 2. Mistral Coordinator MVP

- Добавить `mistralCoordinator.ts` в Electron.
- Сделать методы:
  - `planGeneration`
  - `generateRules`
  - `critiqueOutput`
  - `summarizeSession`
- Добавить schema validation.
- Добавить env validation для `MISTRAL_API_KEY`.

### Phase 3. UI Integration

- В `ExportPanel` показать Mistral plan.
- В `SessionPanel` заменить текстовый парсинг на structured session analysis.
- В `MMSSRuntimePanel` разрешить запуск Python по Mistral plan.

### Phase 4. Feedback Loop

- Сохранять истории генераций.
- Добавить локальный scoring.
- Давать Mistral доступ к history summary.
- Строить цикл `plan -> execute -> critique -> refine`.

## Практические рекомендации по коду

### Что изменить в первую очередь

1. `electron/metaStore.ts`
   Сделать поддержку расширенных composition modes и rules.

2. `renderer/src/vite-env.d.ts`
   Убрать дублирование доменных типов, использовать импортируемые shared-типы.

3. `renderer/src/utils/MMSSRuntimeService.ts`
   Убрать собственную декларацию `Window`, использовать единый контракт.

4. `renderer/src/services/MistralService.ts`
   Разделить transport layer и orchestration layer.

5. `renderer/src/services/SessionStateManager.ts`
   Перенести storage из `localStorage` в Electron-backed persistence.

6. `extension/background.js`
   Сделать session context богаче:
   - session id
   - last N message summaries
   - quality flags

### Чего не делать

- не парсить свободный текст модели регулярками там, где можно требовать JSON;
- не отдавать Mistral право напрямую писать в БД без validation;
- не хранить API key в renderer;
- не смешивать orchestration, transport и UI в одном модуле.

## Безопасность и эксплуатация

### Обязательные правила

- `MISTRAL_API_KEY` должен использоваться только в Electron main process.
- Renderer должен получать только результат, а не ключ.
- Перед отправкой в Mistral нужно ограничивать объем raw JSON.
- Желательно редактировать или вырезать лишние технические поля.
- Нужно ввести token budget и request timeout.

### Минимальные env-переменные

```env
MISTRAL_API_KEY=your_key_here
MISTRAL_MODEL=mistral-large-latest
```

## Запуск проекта

### Установка

```bash
npm install
```

### Разработка

```bash
npm run dev
```

### Тесты

```bash
npm test
```

### Сборка

```bash
npm run build
```

На момент этой ревизии сборка требует исправления type drift, описанного выше.

## Полезные файлы

- `electron/main.ts` — IPC, WebSocket, HTTP API, Mistral transport
- `electron/preload.ts` — bridge между main и renderer
- `electron/metaStore.ts` — хранение метаданных и snapshot
- `renderer/src/store/promptStore.ts` — основной store приложения
- `renderer/src/services/MistralService.ts` — текущая Mistral интеграция
- `renderer/src/services/SessionStateManager.ts` — session intelligence
- `renderer/src/utils/exportComposer.ts` — локальная логика экспорта
- `renderer/src/utils/MMSSRuntimeService.ts` — bridge к Python scripts
- `extension/background.js` — orchestration в extension
- `extension/content.js` — интеграция с `producer.ai`
- `system/rule_engine.py` — генерация по правилам
- `system/self_rule_engine.py` — эволюция правил
- `system/mutation_engine.py` — mutation flow
- `system/builder_v3.py` — основной builder

## Итог

Сейчас `Prompt DB Local` уже содержит почти все строительные блоки для сильной локальной системы генерации:

- импорт;
- локальную библиотеку;
- аналитический слой;
- экспорт;
- extension;
- Python engines;
- session context;
- Mistral transport.

Следующий качественный шаг — не просто "добавить еще одну AI-кнопку", а собрать полноценный `Mistral coordination layer`, который будет:

- планировать;
- генерировать правила;
- запускать подходящий engine;
- критиковать результат;
- запоминать успешные стратегии.

Именно это превратит проект из набора полезных модулей в управляемую систему эволюции промтов и правил.
