# TASK PLAN: GPT UI Rebuild

## Goal
Перевести приложение на один главный фокус: `react/my-app`, аккуратно отключить лишние audio/performance ветки, сохранить рабочими `Prompt Library`, `ASE Console`, `Archives`, а затем собрать новую единую оболочку на основе `src/main-template-new.tsx` без деградации функций.

## Rules
- Работаем в `main`.
- Backup branch уже создан: `backup/ui-rebuild-preflight-2026-05-03`.
- Ничего не удаляем необратимо, пока новый shell не внедрён и не подтверждён.
- Python-скрипты, используемые или потенциально полезные для `react/my-app`, не трогаем.
- Любое отключение делаем обратимым: сначала отвязка/скрытие, потом только возможная чистка.
- UI должен становиться проще и яснее, а не богаче на параллельные панели и повторяющуюся навигацию.

## Stage 1. Stabilize source of truth
1. Привести архиватор к одному имени `flowmusic`.
2. Убрать расхождение между `producer_backup_*` и `flowmusic_backup_*`.
3. Сделать один конфиг путей и имён аккаунтов для:
   - `react/my-app/src/services/ProducerArchiverService.js`
   - `react/my-app/archiver-server.js`
   - связанного UI
4. Сохранить обратную совместимость, если на диске уже есть `producer_backup_*`.

## Stage 2. Remove wrong app focus
1. Подтвердить, что основной app это `react/my-app`.
2. Отключить Electron-приложение как основной фокус разработки.
3. Не удалять общие Python-скрипты и bridge-утилиты, если они могут понадобиться `react/my-app`.
4. Очистить точки входа и тексты, которые уводят в неверную сторону.

## Stage 3. Detach audio/performance layer
1. Аккуратно убрать из основного UI:
   - `Performance`
   - `Advanced Prismatic Core`
   - `Vision UI / Unified MMSS Dispatcher`
   - `Audio Engine Panel`
   - `Orbit Motion Panel`
   - `Image Analysis Panel`
   - `Intent Panel`
   - `System Panels`
   - `Capture Baseline`
   - `Orbit Start`
   - `Play`
   - `Bind Vision`
2. Не задеть рабочие режимы:
   - `Prompt Library`
   - `ASE Console`
   - `Archives`
3. Сохранить принцип `PrismaticCore Sync` в `ASE Audio Decomposer`, но держать его disabled до будущей реинтеграции.
4. Сначала отвязать UI и навигацию, потом чистить хвосты и зависимости.

## Stage 4. Prepare new shell
1. Разобрать `react/my-app/src/main-template-new.tsx`.
2. Перевести шаблон в совместимый с проектом React-формат.
3. Выделить в шаблоне:
   - layout
   - navigation shell
   - panels
   - reusable cards
   - action bars
4. Перенести визуальную иерархию, размеры, читаемость и тему без потери ясности.

## Stage 5. Rebuild app around 3 core modes
1. Собрать одну страницу без перехода на другие страницы.
2. В новой оболочке разместить:
   - `Prompt Library`
   - `ASE Console`
   - `Archives`
3. Сохранить текущую функциональность каждого режима.
4. Сделать общую навигацию по подрежимам простой, без дублирующих слоёв управления.
5. Подтянуть single-page workflow, rail/drawer и template-like layout только там, где это реально улучшает UX.

## Stage 6. Integrate logic into new shell
1. Подключить существующие store/state/actions.
2. Перенести sub-panels `Prompt Library`.
3. Встроить unified workflow `ASE Console`.
4. Встроить `Archives` и связанный import/archive workflow.
5. Проверить, что функции остаются доступны без деградации.

## Stage 7. Validation and cleanup
1. Прогон сборки.
2. Smoke-check основных потоков:
   - archives import / scan
   - ASE unified pipeline
   - prompt block / sequence workflow
3. После подтверждения пользователя:
   - сокращать старый UI
   - убирать мёртвые панели
   - чистить лишние импорты и маршруты
