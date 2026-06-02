```json
{
  "TASK_BOARD": {
    "PHASE_1_CORE_PIPELINE": {
      "TODAY_NEXT": [
        {
          "id": "ARCH-003",
          "title": "Отделить retrieval backend от UI логики json-genesis",
          "contextHint": "Базовые schema/index/injector уже добавлены. Теперь нужно зачистить оставшийся fallback и зафиксировать backend-first contract как единственный основной путь."
        },
        {
          "id": "BE-002",
          "title": "Сделать backend endpoint для retrieval candidates",
          "contextHint": "Endpoint уже существует в базовом виде. Следующий шаг — формализовать ответ, стабилизировать payload и сделать его опорной точкой для UI."
        },
        {
          "id": "BE-003",
          "title": "Вынести reranking в отдельный модуль",
          "contextHint": "Сейчас scoring частично живет рядом с retrieval. Нужен отдельный прозрачный reranker с breakdown по lexical, structural, role и MMSS score."
        }
      ],
      "THIS_WEEK": [
        {
          "id": "UI-001",
          "title": "Довести multi-step pipeline до backend-driven retrieval",
          "contextHint": "fetchCandidates и bridge retrieval уже подключены, но pipeline еще нужно дочистить до полностью backend-driven поведения без неявных UI-обходов."
        },
        {
          "id": "UI-002",
          "title": "Показать score breakdown и role match в UI как отдельные поля",
          "contextHint": "Это следующий практический слой управления качеством retrieval после вынесения reranker."
        },
        {
          "id": "BE-004",
          "title": "Стабилизировать Mistral proxy для genesis-json сценария",
          "contextHint": "Нужно окончательно развести planning, generation и validation режимы и зафиксировать JSON contract на proxy-слое."
        },
        {
          "id": "MMSS-003",
          "title": "Сделать quality-report для generated MMSS JSON",
          "contextHint": "После retrieval/generation нужен видимый quality gate: operators, metrics, principles и structural consistency."
        },
        {
          "id": "TEST-002",
          "title": "Покрыть retrieval ranking тестами на MMSS-блоках",
          "contextHint": "Без тестов на ranking нельзя безопасно менять scoring и reranking."
        }
      ],
      "LATER": [
        {
          "id": "BE-005",
          "title": "Добавить post-generation validation endpoint",
          "contextHint": "Серверный quality gate имеет смысл после стабилизации retrieval/mistral contract."
        },
        {
          "id": "UI-003",
          "title": "Сделать отдельную панель generation debug trace",
          "contextHint": "Панель должна явно показывать approved blocks, applied principles, metaDirectives и request summary."
        },
        {
          "id": "UI-005",
          "title": "Сохранение preset в bridge и локально",
          "contextHint": "Базовая версия уже работает, но синхронизацию состояния надо довести до устойчивого режима."
        },
        {
          "id": "UI-006",
          "title": "Полный inspector library block без reload",
          "contextHint": "Inspector уже есть, но его нужно обогатить lineage и derived MMSS metadata."
        },
        {
          "id": "TEST-001",
          "title": "Покрыть promptLibrary import/export и combinePromptBlocks тестами",
          "contextHint": "Это базовая страховка главного MMSS library source."
        },
        {
          "id": "TEST-003",
          "title": "Покрыть json-genesis pipeline integration тестами",
          "contextHint": "Нужны сценарии plan -> preview -> approve -> generate, включая includeMmssMeta."
        }
      ],
      "BLOCKED": [
        {
          "id": "MMSS-004",
          "title": "Добавить self-correction loop для failed MMSS validation",
          "contextHint": "Нельзя делать до появления полноценного validation report и quality gate."
        },
        {
          "id": "TEST-004",
          "title": "Сделать golden fixtures для generated MMSS JSON",
          "contextHint": "Осмысленно только после стабилизации generation contract и quality-report."
        }
      ]
    },
    "PHASE_2_PYTHON_ADAPTERS_MCP": {
      "TODAY_NEXT": [],
      "THIS_WEEK": [
        {
          "id": "INT-001",
          "title": "Выбрать безопасные integration points из prompt-db-local",
          "contextHint": "Нужно определить только будущие adapter-точки без внедрения legacy runtime в core path."
        }
      ],
      "LATER": [
        {
          "id": "INT-002",
          "title": "Сделать Python adapter для optional retrieval augmentation",
          "contextHint": "Подключать только после завершения PHASE 1 и стабилизации Node retrieval contract."
        },
        {
          "id": "INT-003",
          "title": "Подключить rule/mutation engines как validation assist, а не core runtime",
          "contextHint": "Это post-generation quality-assist слой, а не часть первого рабочего контура."
        }
      ],
      "BLOCKED": [
        {
          "id": "INT-002",
          "title": "Сделать Python adapter для optional retrieval augmentation",
          "contextHint": "Зависит от завершения retrieval backend и формального schema/endpoint слоя."
        },
        {
          "id": "INT-003",
          "title": "Подключить rule/mutation engines как validation assist, а не core runtime",
          "contextHint": "Зависит от готового quality-report и стабильной post-generation validation схемы."
        }
      ]
    },
    "PHASE_3_ADVANCED_GRAPH_EMBEDDINGS_EXPERIMENTS": {
      "TODAY_NEXT": [],
      "THIS_WEEK": [],
      "LATER": [
        {
          "id": "UI-004",
          "title": "Добавить режим сравнения двух candidate блоков",
          "contextHint": "Полезно для продвинутой аналитики retrieval, но не входит в минимальный рабочий контур."
        },
        {
          "id": "INT-002",
          "title": "Сделать Python adapter для optional retrieval augmentation",
          "contextHint": "В этой фазе это уже semantic/embedding augmentation поверх готового lexical+structural ядра."
        },
        {
          "id": "INT-003",
          "title": "Подключить rule/mutation engines как validation assist, а не core runtime",
          "contextHint": "Можно использовать для экспериментального self-correction и variant generation."
        },
        {
          "id": "MMSS-004",
          "title": "Добавить self-correction loop для failed MMSS validation",
          "contextHint": "Подходит для advanced closed-loop generation после появления graph/memory/validation слоя."
        },
        {
          "id": "TEST-004",
          "title": "Сделать golden fixtures для generated MMSS JSON",
          "contextHint": "Нужно для устойчивости продвинутых graph/embedding/validation сценариев."
        }
      ],
      "BLOCKED": [
        {
          "id": "INT-002",
          "title": "Сделать Python adapter для optional retrieval augmentation",
          "contextHint": "Без завершенного PHASE 1 и стабилизации retrieval API эта задача преждевременна."
        },
        {
          "id": "MMSS-004",
          "title": "Добавить self-correction loop для failed MMSS validation",
          "contextHint": "Требует готовых validation metrics, quality-report и достаточно стабильного generation contract."
        }
      ]
    }
  },
  "DAILY_CHECKLIST": [
    "Выбрать 1-3 задачи только из PHASE_1_CORE_PIPELINE.TODAY_NEXT или THIS_WEEK и не распыляться на phase 2/3.",
    "Перед началом работы сверить, не затрагивает ли задача MMSS_CRITICAL_PATH.",
    "Если меняется retrieval, generation или validation contract, обновить schema/docs в том же сеансе.",
    "После заметных изменений запускать минимальные тесты или lint для затронутого слоя.",
    "После правок retrieval проверять candidate blocks, approved context payload, includeMmssMeta и generation trace.",
    "Новые MMSS patterns, operators, metric fields и role hints фиксировать в одном месте, а не разбрасывать по UI-коду.",
    "Любую интеграцию с prompt-db-local сначала помечать как optional adapter, а не core dependency.",
    "В конце рабочего сеанса обновлять progress log: что сделано, что блокирует, что стало следующим фокусом."
  ],
  "MCP_TOOLS_SPEC": [
    {
      "name": "mmss_list_blocks",
      "purpose": "Вернуть список MMSS-блоков с базовой metadata и фильтрами по category, tags и roles.",
      "inputs": ["limit", "offset", "category", "tags", "role"],
      "outputs": ["blocks[]", "total"],
      "relatedTaskIds": ["ARCH-002", "BE-001", "BE-002"],
      "integrationLayer": "MMSS_LIBRARY_SOURCE + RETRIEVAL_SELECTION_LAYER"
    },
    {
      "name": "mmss_get_block",
      "purpose": "Прочитать полный payload одного MMSS-блока вместе с derived metadata.",
      "inputs": ["blockId"],
      "outputs": ["block", "derivedMetadata"],
      "relatedTaskIds": ["ARCH-002", "UI-006", "MMSS-001"],
      "integrationLayer": "MMSS_LIBRARY_SOURCE + UI_JSON_GENESIS"
    },
    {
      "name": "mmss_search_blocks",
      "purpose": "Сделать retrieval по prompt/query/role/metric/operator и вернуть candidate blocks со score breakdown.",
      "inputs": ["prompt", "queries[]", "blockRoles[]", "includeMmssMeta", "limit"],
      "outputs": ["candidates[]", "scoreBreakdown", "queryTokens"],
      "relatedTaskIds": ["BE-001", "BE-002", "BE-003", "UI-001", "UI-002"],
      "integrationLayer": "RETRIEVAL_SELECTION_LAYER"
    },
    {
      "name": "mmss_compose_context",
      "purpose": "Собрать approved MMSS context payload для Mistral из выбранных блоков, principles и meta rules.",
      "inputs": ["approvedBlockIds[]", "principles[]", "metaDirectives[]", "includeMmssMeta"],
      "outputs": ["libraryContextJson", "contextSummary"],
      "relatedTaskIds": ["UI-001", "MMSS-002", "BE-004"],
      "integrationLayer": "UI_JSON_GENESIS + MISTRAL_API_LAYER"
    },
    {
      "name": "mmss_generate_module",
      "purpose": "Запустить Mistral JSON generation на основе approved context и generation mode.",
      "inputs": ["prompt", "mode", "currentStructure", "libraryContextJson", "rules"],
      "outputs": ["generatedJson", "requestTrace"],
      "relatedTaskIds": ["BE-004", "UI-003", "MMSS-002"],
      "integrationLayer": "MISTRAL_API_LAYER"
    },
    {
      "name": "mmss_validate_json",
      "purpose": "Проверить generated MMSS JSON на structural consistency, operators coverage, metrics coverage и required fields.",
      "inputs": ["generatedJson", "validationProfile", "expectedOperators[]", "expectedMetrics[]"],
      "outputs": ["isValid", "qualityReport", "issues[]", "corrections[]"],
      "relatedTaskIds": ["BE-005", "MMSS-001", "MMSS-003", "MMSS-004"],
      "integrationLayer": "MMSS_VALIDATION_METRICS_LAYER"
    },
    {
      "name": "mmss_extract_metrics",
      "purpose": "Вытащить из блока или generated JSON MMSS-метрики, operators, formulas и role hints.",
      "inputs": ["json"],
      "outputs": ["metrics[]", "operators[]", "formulas[]", "roleHints[]"],
      "relatedTaskIds": ["MMSS-001", "MMSS-002", "UI-006"],
      "integrationLayer": "MMSS_VALIDATION_METRICS_LAYER + UI_JSON_GENESIS"
    },
    {
      "name": "mmss_graph_lookup",
      "purpose": "Опциональный advanced tool для graph/embedding retrieval augmentation и поиска соседних паттернов.",
      "inputs": ["blockId", "prompt", "relationType", "limit"],
      "outputs": ["neighbors[]", "semanticMatches[]", "graphContext"],
      "relatedTaskIds": ["INT-002", "INT-003"],
      "integrationLayer": "OPTIONAL_PYTHON_JS_ADAPTER_LAYER"
    }
  ],
  "FOCUS_FILTER": {
    "DO_FIRST": ["ARCH-003", "BE-002", "BE-003", "UI-001", "UI-002", "BE-004", "MMSS-003", "TEST-002"],
    "CAN_IGNORE_FOR_NOW": ["UI-004", "INT-002", "INT-003", "MMSS-004", "TEST-004"],
    "MMSS_CRITICAL_PATH": ["ARCH-002", "ARCH-003", "BE-001", "BE-002", "BE-003", "BE-004", "UI-001", "MMSS-001", "MMSS-002", "MMSS-003", "TEST-002", "TEST-003"]
  }
}
```
