# MMSS Skill Tree Runtime Plan

## Context

- Текущая база рабочая: `MMSS Invariants`, `Local LLM RAG`, векторизация и multi-DB retrieval уже функционируют.
- Следующий слой не про новый UI-режим, а про runtime-надстройку поверх существующего RAG:
  `generation logging -> skill definitions -> skill sets -> skill trees -> orchestration`.
- Базовый принцип сохраняется:
  `Ollama + pgvector + PostgreSQL` остаются ядром, а `Skill Tree` встраивается как MMSS-надстройка.

## Design Principles

- Не векторизировать все подряд.
  В векторный слой попадают только структурированные MMSS-инварианты и связанные с ними runtime-артефакты.
- Не ломать существующий `Local LLM RAG`.
  Новая логика добавляется поверх уже работающего контура.
- Все DB-операции должны быть идемпотентными.
  Повторный запуск не должен дублировать сущности без необходимости.
- Любой новый runtime-результат должен быть пригоден для повторного использования через RAG.

## Current Goal

Построить первый рабочий слой `MMSS Skill Tree Runtime`, который:

1. Логирует MMSS-ответы и контексты в БД.
2. Создает минимальные сущности skill-tree в `abstract-mind-lab`.
3. Дает backend endpoint для проектирования skill-tree через уже существующий RAG.
4. Подготавливает базу для дальнейшей оркестрации и метрик.

## Phase 1: Runtime Schema

- [ ] Добавить таблицу `mmss_generation_results`.
- [ ] Добавить таблицу `mmss_skills`.
- [ ] Добавить таблицу `mmss_skill_sets`.
- [ ] Добавить таблицу `mmss_skill_trees`.
- [ ] Добавить таблицу `mmss_skill_runs`.
- [ ] Создать индексы по runtime lookup-полям:
  `mode`, `created_at`, `tree_id`, `skill_set_id`, `skill_id`, `owner_scope`.

### Required Table Intent

- `mmss_generation_results`
  хранит query, mode, answer, retrievedSources, promptContextText, debug_payload, metadata.
- `mmss_skills`
  хранит атомарные навыки.
- `mmss_skill_sets`
  хранит группы навыков и flow между ними.
- `mmss_skill_trees`
  хранит root_goal, дерево skill_sets и cross-links.
- `mmss_skill_runs`
  хранит фактические исполнения и поля для K/P/A/R/T метрик.

## Phase 2: MMSS Answer Logging

- [ ] Расширить `answerWithRag`, чтобы MMSS-режимы автоматически логировались в `mmss_generation_results`.
- [ ] Логировать как минимум:
  `query`, `mode`, `model`, `sourceScopes`, `retrievedSources`, `promptContextText`, `answer`, `debug`.
- [ ] Добавить `metadata.operation` и `metadata.origin` для различения:
  `rag_answer`, `skill_tree_design`, `problem_map`, `diagnosis`.
- [ ] Не падать всем запросом, если логирование не удалось.
  Ошибка логирования не должна ломать ответ пользователю.

## Phase 3: Minimal Skill Tree Designer

- [ ] Добавить backend endpoint `POST /api/mmss/skill-tree/design`.
- [ ] На вход принимать:
  `goal`, `database`, `sourceScopes`, `topK`, `queryBudget`, `model`, `ownerScope`, `contextHint`.
- [ ] Использовать уже существующий RAG для получения MMSS-контекста.
- [ ] Сгенерировать минимальный JSON-результат структуры:
  `problem_map -> diagnosed_problem_space -> skills -> skill_set -> skill_tree`.
- [ ] Сохранять результат:
  в `mmss_skills`,
  `mmss_skill_sets`,
  `mmss_skill_trees`,
  а также в `mmss_generation_results`.

### Minimal Output Contract

```json
{
  "problem_map": {
    "goal": "string",
    "nodes": []
  },
  "diagnosed_problem_space": {
    "constraints": [],
    "gaps": [],
    "signals": []
  },
  "skills": [],
  "skill_set": {},
  "skill_tree": {}
}
```

## Phase 4: Runtime Execution Skeleton

- [ ] Подготовить минимальный runtime-каркас для `mmss_skill_runs`.
- [ ] Пока без полной оркестрации, но с готовым форматом записи исполнения.
- [ ] Заложить поля:
  `success`, `quality_score`, `duration_ms`, `context_switches`, `mode`, `metadata`.

## Phase 5: Future Work After First Runtime Slice

- [ ] Расширить `mmss_invariants` категориями:
  `skill_definition`, `skill_set_definition`, `skill_tree_definition`, `orchestration_rule`.
- [ ] Связать skill-tree с `invariants_extractor`.
- [ ] Реализовать отдельный runtime endpoint вида:
  `POST /api/mmss/skill-tree/run`.
- [ ] Реализовать maintenance-цикл:
  `eliminate_zombie_skills`,
  `strengthen_high_impact_branches`,
  `merge_duplicate_skills`,
  `autonomy_ramp_up`.

## Immediate Implementation Order

1. Создать DB runtime schema.
2. Включить автоматическое логирование MMSS-ответов.
3. Реализовать `POST /api/mmss/skill-tree/design`.
4. Сохранять минимальный result graph в БД.
5. Прогнать build и server syntax checks.

## Non-Goals For This Slice

- Не перестраивать UI до завершения backend-среза.
- Не внедрять полную автономную оркестрацию skill-tree в одном заходе.
- Не переносить весь `invariants_extractor` в новый pipeline до завершения runtime schema.

## MMSS Skill Tree Runtime Review Notes

- План `Skill Tree Runtime` согласован с текущей архитектурой:
  локальный RAG (`Ollama + pgvector + PostgreSQL`) остается ядром,
  а skill-tree добавляется как MMSS-надстройка на уровне схемы БД, логирования и backend-endpoint'ов.
- Линия
  `generation logging -> skills -> skill_sets -> skill_trees -> orchestration`
  дает тонкий вертикальный срез и не требует немедленных UI-изменений или полного RVM.

## Phase 1 – Runtime Schema (Notes)

- Таблицы
  `mmss_generation_results`, `mmss_skills`, `mmss_skill_sets`, `mmss_skill_trees`, `mmss_skill_runs`
  остаются как в плане, но сразу закладывают:
  `UNIQUE`-ограничения на `skill_id`, `skill_set_id`, `tree_id`.
- Для `mmss_skill_trees` обязательно держать `version`:
  либо отдельным полем, либо как стабильное поле в `metadata`.
- Индексы по
  `mode`, `created_at`, `tree_id`, `skill_set_id`, `skill_id`, `owner_scope`
  обязательны для runtime lookup и аналитики.

## Phase 2 – MMSS Answer Logging (Notes)

- `answerWithRag` остается главной точкой логирования MMSS-режимов в `mmss_generation_results`.
- Минимальный обязательный набор записи:
  `query`, `mode`, `model`, `sourceScopes`, `retrievedSources`, `promptContextText`, `answer`, `debug`, `metadata`.
- В `metadata` использовать понятные маркеры:
  `operation = rag_answer | skill_tree_design | problem_map | diagnosis`
  и
  `origin = ase_console | mmss_skill_tree_design | mmss_manual_test`.
- Логирование обязано быть `best-effort`:
  ошибка записи в БД не должна ломать основной ответ пользователю.

## Phase 3 – Minimal Skill Tree Designer (Notes)

- `POST /api/mmss/skill-tree/design` остается целевым тонким вертикальным срезом.
- Входы:
  `goal`, `database`, `sourceScopes`, `topK`, `queryBudget`, `model`, `ownerScope`, `contextHint`.
- Внутренняя логика первого среза:
  один вызов существующего RAG для MMSS-контекста
  и один вызов локальной LLM, возвращающий структурированный JSON:
  `problem_map -> diagnosed_problem_space -> skills -> skill_set -> skill_tree`.
- После ответа backend сохраняет:
  `skills` в `mmss_skills`,
  `skill_set` в `mmss_skill_sets`,
  `skill_tree` в `mmss_skill_trees`,
  полный ответ и контекст в `mmss_generation_results`
  с `metadata.operation = skill_tree_design`.
- На первом шаге достаточно одного `skill_set` и одного `skill_tree` на запрос.

## Phase 4 – Runtime Execution Skeleton (Notes)

- Цель фазы:
  подготовить формат и минимальный каркас `mmss_skill_runs`, но без полной оркестрации.
- Рекомендуемый следующий шаг:
  простой тестовый endpoint вроде `/api/mmss/skill-tree/run/dummy`, который:
  принимает простой payload,
  выполняет минимальное действие (`RAG` вызов или `no-op`),
  пишет строку в `mmss_skill_runs`.
- Поля минимальной записи:
  `tree_id`, `skill_set_id`, `skill_id`, `success`, `quality_score`, `duration_ms`, `context_switches`, `mode`, `metadata`.

## Phase 5 – Future Work (Notes)

- При расширении `mmss_invariants` категориями
  `skill_definition`, `skill_set_definition`, `skill_tree_definition`, `orchestration_rule`
  связывать инварианты с конкретными
  `mmss_skills / mmss_skill_sets / mmss_skill_trees`
  через идентификаторы или metadata.
- До переноса всей логики `invariants_extractor` в новый pipeline сначала завершить runtime-срез:
  схема БД,
  логирование ответов,
  endpoint `skill-tree/design`,
  запись минимального result graph.
- Maintenance-цикл
  `eliminate_zombie_skills`,
  `strengthen_high_impact_branches`,
  `merge_duplicate_skills`,
  `autonomy_ramp_up`
  имеет смысл включать только после накопления истории в
  `mmss_skill_runs` и `mmss_generation_results`.
- Возможный viewer дерева навыков в UI оставляется после стабилизации backend-слоя.

## Immediate Implementation Notes

1. Создать runtime schema:
   все `mmss_*` таблицы, индексы, `UNIQUE`-ограничения.
2. Включить автоматическое логирование MMSS-ответов в `answerWithRag`.
3. Реализовать `POST /api/mmss/skill-tree/design`
   с минимальным JSON-контрактом и записью в БД.
4. Сохранять result graph:
   `problem_map`, `diagnosed_problem_space`, `skills`, `skill_set`, `skill_tree`.
5. Прогнать build и server syntax checks.

Дополнительно:

- Добавить миграционный health-check:
  скрипт или endpoint, который проверяет наличие новых таблиц и базовую возможность чтения/записи.
- Зафиксировать стабильные значения `mode` и `metadata.operation` для MMSS-специфичных запросов,
  чтобы упростить фильтрацию и аналитику.
## Async Design Job Notes

- Heavy `skill-tree/design` runs should use a background job flow instead of a long-lived HTTP sync request.
- Keep `POST /api/mmss/skill-tree/design` as a lightweight sync/debug fallback.
- Main production path:
  `POST /api/mmss/skill-tree/design/async`
  -> `GET /api/mmss/skill-tree/design/job/:jobId`
  -> optional `POST /api/mmss/skill-tree/design/job/:jobId/cancel`
- Default practical policy for slow local models:
  `topK=2`, `queryBudget=2`, `sourceScopes=['mmss_invariants']`, elevated timeout.
