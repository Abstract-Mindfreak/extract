# TASK: Local RAG MMSS -> `batiai/gemma4-e2b:q4`

## Цель

Перевести уже собранный локальный RAG-слой в режим практической работы с локальной reasoning-моделью `batiai/gemma4-e2b:q4` через Ollama.

Речь идет не о повторной векторизации как таковой, а о следующем слое:
- извлечь релевантный RAG-контекст из PostgreSQL
- собрать его в компактный, управляемый prompt
- передать этот контекст в локальную LLM
- вернуть результат в ASE Console с трассировкой источников

## Что уже готово

### Инфраструктура

- PostgreSQL базы:
  - `abstract-mind-lab`
  - `abstract_mind_db`
- расширение `vector` установлено
- локальный Ollama доступен по `http://localhost:11434/api`
- модель эмбеддингов `embeddinggemma:300m` работает
- модель `batiai/gemma4-e2b:q4` установлена локально

### Текущий RAG-слой

Уже реализовано:
- таблица `rag_document_embeddings`
- batch-векторизация через Ollama `/api/embed`
- semantic search по `pgvector`
- UI-панель `Local LLM RAG`
- поддержка двух БД
- отмена job
- диагностика стадий job

Фактически это значит:
- слой хранения векторов готов
- слой retrieval готов
- но слой `retrieval -> context assembly -> local LLM answer` еще не завершен

## Ключевой вывод

### Да, к передаче RAG-контекста в `batiai/gemma4-e2b:q4` мы почти готовы.

Но не хватает трех важных компонентов:

1. отдельного backend endpoint для локального RAG-answer generation
2. нормализованной сборки prompt-контекста из top-k результатов
3. UI-режима, который вызывает local LLM поверх retrieval, а не только показывает search results

## Предлагаемый план

### Этап 1. Стабилизация retrieval-слоя

Нужно довести текущий RAG до стабильного production-like состояния:

- ограничить размер `chunk_text` для тяжелых источников
- хранить облегченный `source_payload`
- добавить `source_kind` / `source_priority`
- добавить `token_estimate`
- добавить `retrieval_debug` в ответ backend

### Этап 2. Context Assembler

Нужен отдельный backend-сервис:
- принимает `query`, `database`, `topK`
- вызывает текущий `searchRag`
- строит компактный контекст для LLM

Формат вывода:

```json
{
  "query": "...",
  "database": "abstract-mind-lab",
  "context_blocks": [
    {
      "rank": 1,
      "source_table": "tracks",
      "source_id": "...",
      "source_title": "...",
      "similarity": 0.91,
      "context_text": "..."
    }
  ],
  "prompt_context_text": "..."
}
```

### Этап 3. Local LLM Answer Endpoint

Добавить backend route:

- `POST /api/rag/answer`

Вход:
- `query`
- `database`
- `topK`
- `model`
- `systemPrompt`
- `mode`

Логика:
1. выполнить retrieval
2. собрать `prompt_context_text`
3. вызвать Ollama generate/chat с `batiai/gemma4-e2b:q4`
4. вернуть:
   - ответ модели
   - использованный контекст
   - список source ids
   - prompt/debug meta

### Этап 4. Prompt Templates

Нужны режимы prompt-сборки:

- `qa`
- `prompt_mutation`
- `session_analysis`
- `mmss_operator_assist`

Важно:
- system prompt должен требовать ссылаться только на retrieved context
- модель не должна додумывать факты без пометки

### Этап 5. UI в ASE Console

В `Local LLM RAG` нужно добавить:

- selector модели
- mode selector
- кнопку `Generate Answer`
- отдельный вывод:
  - retrieved context
  - final prompt
  - final answer
  - source provenance

### Этап 6. Provenance и audit

Каждый ответ локальной LLM должен возвращать:

- `model`
- `database`
- `topK`
- `retrieved_sources`
- `prompt_chars`
- `context_chars`
- `generation_duration_ms`

Опционально:
- сохранять answer trace в `app_entity_store`

## Что НЕ нужно делать сейчас

- не нужно заново проектировать схему pgvector
- не нужно менять embedding model
- не нужно пытаться передавать в LLM сырые float-векторы

Правильная схема:

`DB rows -> embeddings -> pgvector retrieval -> compact text context -> gemma4-e2b:q4`

## Минимальный MVP

1. backend `context assembler`
2. backend `POST /api/rag/answer`
3. UI-кнопка `Generate Answer`
4. модель по умолчанию `batiai/gemma4-e2b:q4`

## Критерии готовности

Считать задачу выполненной, когда:

- `Local LLM RAG` умеет не только искать, но и генерировать ответ
- ответ строится на основе retrieved context
- в UI видно provenance
- `batiai/gemma4-e2b:q4` вызывается локально через Ollama
- pipeline работает минимум для:
  - `abstract-mind-lab / tracks`
  - `abstract-mind-lab / sessions`
  - `abstract_mind_db / music_blocks`

## Рекомендуемая конфигурация

- embedding model:
  - `embeddinggemma:300m`
- local answer model:
  - `batiai/gemma4-e2b:q4`
- topK:
  - `4` или `5`
- batch size vectorization:
  - `2-3` для `tracks`
  - `8-12` для `music_blocks`

## Следующий конкретный шаг

Следующая реализация должна быть не про еще одну индексацию, а про:

**`searchRag -> buildPromptContext -> call batiai/gemma4-e2b:q4 -> return answer with sources`**

## Status Update 2026-06-14

Реализовано:
- `POST /api/rag/search`
- `POST /api/rag/context`
- `POST /api/rag/answer`
- локальный ответ через `batiai/gemma4-e2b:q4`
- кросс-БД retrieval через `sourceScopes`
- parameter `queryBudget` со значением `1..100`
- динамические retrieval templates под режимы ASE Console

Поддерживаемые режимы:
- `qa`
- `prompt_mutation`
- `session_analysis`
- `mmss_operator_assist`
- `cross_db_reconciliation`
- `json_prompt_extraction`
- `source_audit`
- `ase_console_recipe`

Проверено:
- совместный поиск по `abstract-mind-lab` и `abstract_mind_db`
- сборка prompt context поверх merged retrieval
- ответ модели с возвратом provenance и debug-метаданных

Следующий UI-этап:
- разнести JSON/answer/debug по FlexLayout-вкладкам
- добавить кнопки `Save to DB` и `Vectorize Result`
- сохранять позиции панелей
