```json
{
  "TASK_BOARD": {
    "PHASE_1_CORE_PIPELINE": {
      "TODAY_NEXT": [
        {
          "id": "ARCH-002",
          "title": "Формализовать контракт данных MMSS block retrieval",
          "contextHint": "Нужно зафиксировать canonical schema для retrieval-кандидата, чтобы UI, Node retrieval и Mistral работали по одному контракту."
        },
        {
          "id": "BE-001",
          "title": "Выделить MMSS retrieval index builder",
          "contextHint": "Это базовый шаг для индексации 5000+ блоков по key paths, ролям, метрикам и операторам."
        },
        {
          "id": "UI-001",
          "title": "Довести multi-step pipeline до backend-driven retrieval",
          "contextHint": "Текущий pipeline уже есть в json-genesis, но retrieval должен перейти из локальной UI-логики в backend service."
        }
      ],
      "THIS_WEEK": [
        {
          "id": "ARCH-003",
          "title": "Отделить retrieval backend от UI логики json-genesis",
          "contextHint": "Без этого стек не будет устойчивым при росте библиотеки и при переходе к MCP-aware архитектуре."
        },
        {
          "id": "BE-002",
          "title": "Сделать backend endpoint для retrieval candidates",
          "contextHint": "Нужен явный endpoint для candidate blocks со score breakdown и role-aware retrieval."
        },
        {
          "id": "BE-003",
          "title": "Вынести reranking в отдельный модуль",
          "contextHint": "Это позволит управлять lexical, structural, role и MMSS scoring независимо от UI."
        },
        {
          "id": "MMSS-001",
          "title": "Определить минимальный MMSS metrics contract для genesis-json",
          "contextHint": "Нужен минимальный обязательный набор operator/metric/formula полей для retrieval, generation и validation."
        },
        {
          "id": "MMSS-002",
          "title": "Сделать MMSS meta-rules injector как отдельный сервис",
          "contextHint": "Сейчас includeMmssMeta уже работает, но логику нужно вынести из UI в переиспользуемый сервис."
        }
      ],
      "LATER": [
        {
          "id": "BE-004",
          "title": "Стабилизировать Mistral proxy для genesis-json сценария",
          "contextHint": "Planning/generation/validation режимы должны быть разведены и формально описаны на уровне proxy."
        },
        {
          "id": "BE-005",
          "title": "Добавить post-generation validation endpoint",
          "contextHint": "После генерации нужен серверный quality gate для MMSS JSON."
        },
        {
          "id": "UI-002",
          "title": "Показать score breakdown и role match в UI как отдельные поля",
          "contextHint": "Это усилит ручной контроль retrieval и поможет быстрее настраивать scoring."
        },
        {
          "id": "UI-003",
          "title": "Сделать отдельную панель generation debug trace",
          "contextHint": "Нужно видеть, что реально ушло в Mistral и какие MMSS rules были применены."
        },
        {
          "id": "UI-005",
          "title": "Сохранение preset в bridge и локально",
          "contextHint": "Часть уже есть, но это стоит довести до устойчивой двусторонней синхронизации без потери состояния."
        },
        {
          "id": "UI-006",
          "title": "Полный inspector library block без reload",
          "contextHint": "Базовая версия уже работает, но inspector нужно обогатить lineage и derived MMSS metadata."
        },
        {
          "id": "MMSS-003",
          "title": "Сделать quality-report для generated MMSS JSON",
          "contextHint": "Следующий необходимый слой после retrieval/generation: coverage operators, metrics и structural consistency."
        },
        {
          "id": "TEST-001",
          "title": "Покрыть promptLibrary import/export и combinePromptBlocks тестами",
          "contextHint": "Это базовая стабильность главного MMSS library source."
        },
        {
          "id": "TEST-002",
          "title": "Покрыть retrieval ranking тестами на MMSS-блоках",
          "contextHint": "Без этого сложно безопасно менять scoring и reranking."
        },
        {
          "id": "TEST-003",
          "title": "Покрыть json-genesis pipeline integration тестами",
          "contextHint": "Нужны тесты на plan -> preview -> approve -> generate, включая includeMmssMeta."
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
          "contextHint": "Нужно заранее понять, какие Python-модули годятся как adapters, но без прямого внедрения в core runtime."
        }
      ],
      "LATER": [
        {
          "id": "INT-002",
          "title": "Сделать Python adapter для optional retrieval augmentation",
          "contextHint": "Это мост к prompt-db-local indexing/embedding логике, но только после готовности Node retrieval contract."
        },
        {
          "id": "INT-003",
          "title": "Подключить rule/mutation engines как validation assist, а не core runtime",
          "contextHint": "Rule/mutation engines лучше вводить как quality-assist слой после базовой MMSS validation."
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
          "contextHint": "В фазе 3 это может расшириться до semantic/embedding retrieval поверх уже работающего lexical+structural ядра."
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
          "contextHint": "Без законченного PHASE_1 и стабилизации retrieval API эта задача преждевременна."
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
    "Выбрать 1–3 задачи только из PHASE_1_CORE_PIPELINE.TODAY_NEXT или THIS_WEEK, не распыляться на phase 2/3.",
    "Перед началом работы сверить, не затрагивает ли задача MMSS_CRITICAL_PATH.",
    "Если меняется retrieval/generation contract, обновить соответствующий schema/architecture JSON или заметку в docs.",
    "После каждого заметного изменения запускать минимальные тесты или lint для затронутого слоя.",
    "После правок retrieval проверять: candidate blocks, approved context payload, includeMmssMeta и generation trace.",
    "Фиксировать новые MMSS-паттерны, operators, metric fields и role hints в одном месте, а не разбрасывать по UI-коду.",
    "Любую интеграцию с prompt-db-local сначала помечать как optional adapter, а не core dependency.",
    "В конце дня обновлять статус задач: что сделано, что блокируется, что стало следующим шагом.",
    "Если появилась новая идея вне PHASE_1, отправлять ее в LATER или CAN_IGNORE_FOR_NOW, не внедрять сразу."
  ],
  "MCP_TOOLS_SPEC": [
    {
      "name": "mmss_list_blocks",
      "purpose": "Вернуть список MMSS-блоков с базовой metadata и фильтрами по category/tags/roles.",
      "inputs": [
        "limit",
        "offset",
        "category",
        "tags",
        "role"
      ],
      "outputs": [
        "blocks[]",
        "total"
      ],
      "relatedTaskIds": [
        "ARCH-002",
        "BE-001",
        "BE-002"
      ],
      "integrationLayer": "MMSS_LIBRARY_SOURCE + RETRIEVAL_SELECTION_LAYER"
    },
    {
      "name": "mmss_get_block",
      "purpose": "Прочитать полный payload одного MMSS-блока вместе с derived metadata: key paths, operators, metrics, structural stats.",
      "inputs": [
        "blockId"
      ],
      "outputs": [
        "block",
        "derivedMetadata"
      ],
      "relatedTaskIds": [
        "ARCH-002",
        "UI-006",
        "MMSS-001"
      ],
      "integrationLayer": "MMSS_LIBRARY_SOURCE + UI_JSON_GENESIS"
    },
    {
      "name": "mmss_search_blocks",
      "purpose": "Сделать retrieval по prompt/query/role/metric/operator и вернуть candidate blocks со score breakdown.",
      "inputs": [
        "prompt",
        "queries[]",
        "blockRoles[]",
        "includeMmssMeta",
        "limit"
      ],
      "outputs": [
        "candidates[]",
        "scoreBreakdown",
        "queryTokens"
      ],
      "relatedTaskIds": [
        "BE-001",
        "BE-002",
        "BE-003",
        "UI-001",
        "UI-002"
      ],
      "integrationLayer": "RETRIEVAL_SELECTION_LAYER"
    },
    {
      "name": "mmss_compose_context",
      "purpose": "Собрать approved MMSS context payload для Mistral из выбранных блоков, principles и meta rules.",
      "inputs": [
        "approvedBlockIds[]",
        "principles[]",
        "metaDirectives[]",
        "includeMmssMeta"
      ],
      "outputs": [
        "libraryContextJson",
        "contextSummary"
      ],
      "relatedTaskIds": [
        "UI-001",
        "MMSS-002",
        "BE-004"
      ],
      "integrationLayer": "UI_JSON_GENESIS + MISTRAL_API_LAYER"
    },
    {
      "name": "mmss_generate_module",
      "purpose": "Запустить Mistral JSON generation на основе approved context и generation mode.",
      "inputs": [
        "prompt",
        "mode",
        "currentStructure",
        "libraryContextJson",
        "rules"
      ],
      "outputs": [
        "generatedJson",
        "requestTrace"
      ],
      "relatedTaskIds": [
        "BE-004",
        "UI-003",
        "MMSS-002"
      ],
      "integrationLayer": "MISTRAL_API_LAYER"
    },
    {
      "name": "mmss_validate_json",
      "purpose": "Проверить generated MMSS JSON на structural consistency, operators coverage, metrics coverage и required fields.",
      "inputs": [
        "generatedJson",
        "validationProfile",
        "expectedOperators[]",
        "expectedMetrics[]"
      ],
      "outputs": [
        "isValid",
        "qualityReport",
        "issues[]",
        "corrections[]"
      ],
      "relatedTaskIds": [
        "BE-005",
        "MMSS-001",
        "MMSS-003",
        "MMSS-004"
      ],
      "integrationLayer": "MMSS_VALIDATION_METRICS_LAYER"
    },
    {
      "name": "mmss_extract_metrics",
      "purpose": "Вытащить из блока или generated JSON MMSS-метрики, operators, formulas и role hints для анализа и отображения.",
      "inputs": [
        "json"
      ],
      "outputs": [
        "metrics[]",
        "operators[]",
        "formulas[]",
        "roleHints[]"
      ],
      "relatedTaskIds": [
        "MMSS-001",
        "MMSS-002",
        "UI-006"
      ],
      "integrationLayer": "MMSS_VALIDATION_METRICS_LAYER + UI_JSON_GENESIS"
    },
    {
      "name": "mmss_graph_lookup",
      "purpose": "Опциональный advanced tool для graph/embedding retrieval augmentation и поиска соседних паттернов.",
      "inputs": [
        "blockId",
        "prompt",
        "relationType",
        "limit"
      ],
      "outputs": [
        "neighbors[]",
        "semanticMatches[]",
        "graphContext"
      ],
      "relatedTaskIds": [
        "INT-002",
        "INT-003"
      ],
      "integrationLayer": "OPTIONAL_PYTHON_JS_ADAPTER_LAYER"
    }
  ],
  "FOCUS_FILTER": {
    "DO_FIRST": [
      "ARCH-002",
      "BE-001",
      "ARCH-003",
      "BE-002",
      "BE-003",
      "UI-001",
      "MMSS-001",
      "MMSS-002"
    ],
    "CAN_IGNORE_FOR_NOW": [
      "UI-004",
      "INT-002",
      "INT-003",
      "MMSS-004",
      "TEST-004"
    ],
    "MMSS_CRITICAL_PATH": [
      "ARCH-002",
      "ARCH-003",
      "BE-001",
      "BE-002",
      "BE-003",
      "BE-004",
      "UI-001",
      "MMSS-001",
      "MMSS-002",
      "MMSS-003",
      "TEST-002",
      "TEST-003"
    ]
  }
}
```