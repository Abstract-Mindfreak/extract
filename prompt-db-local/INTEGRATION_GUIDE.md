# Prompt DB Local: Руководство по интеграции и объединению слоёв

## Архитектура слоёв системы

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         АРХИТЕКТУРА СЛОЁВ PROMPT DB LOCAL                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  LAYER 1: DATA IMPORT                    LAYER 2: META STRUCTURE                   │
│  ┌──────────────────────┐              ┌──────────────────────┐                   │
│  │ WebSocket Server     │              │ Tag Registry         │                   │
│  │ HTTP API             │────────────>│ Key Sequences        │                   │
│  │ File System          │              │ Export Presets       │                   │
│  │ Chrome Extension     │              │ Element Bindings     │                   │
│  └──────────────────────┘              └──────────────────────┘                   │
│           │                                      │                                 │
│           ▼                                      ▼                                 │
│  ┌──────────────────────┐              ┌──────────────────────┐                       │
│  │ IndexedDB (Dexie)  │<────────────>│ Meta Store (JSON)    │                     │
│  │ - prompts          │              │ - tag-registry.json  │                     │
│  │ - json_data        │              │ - element-bindings   │                     │
│  │ - raw blocks       │              │ - sequence-presets   │                     │
│  └──────────────────────┘              └──────────────────────┘                     │
│           │                                      │                                 │
│           └──────────────┬───────────────────────┘                                 │
│                          │                                                         │
│                          ▼                                                         │
│  LAYER 3: PYTHON PROCESSING            LAYER 4: COMPOSITION                        │
│  ┌──────────────────────┐              ┌──────────────────────┐                     │
│  │ Transform Blocks     │              │ Export Composer      │                   │
│  │ Indexer V3           │────────────>│ - Filter Engine      │                   │
│  │ Builder V3           │              │ - Pattern Builder    │                   │
│  │ Mutation Engine      │              │ - File Generator     │                   │
│  │ Rule Engine          │              │ - Preview System     │                   │
│  └──────────────────────┘              └──────────────────────┘                   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Стратегии комбинаторики слоёв

### Стратегия 1: Линейная композиция (Linear Composition)

**Описание:** Последовательное прохождение через все слои без обратной связи.

```
Import → Meta Structure → Python Processing → Composition → Export
```

**Применение:**
- Быстрые одноразовые задачи
- Простые преобразования форматов
- Предсказуемые результаты

**Код интеграции:**

```typescript
// LinearCompositionStrategy.ts
export class LinearCompositionStrategy {
  async execute(data: RawJsonData): Promise<ExportResult> {
    // Layer 1: Import
    const imported = await this.importLayer.process(data);
    
    // Layer 2: Meta Structure
    const tagged = await this.metaLayer.scanAndTag(imported);
    const sequenced = await this.metaLayer.extractSequences(tagged);
    
    // Layer 3: Python Processing
    const transformed = await this.pythonLayer.transform(tagged);
    const indexed = await this.pythonLayer.index(transformed);
    const built = await this.pythonLayer.build(indexed, {
      intent: 'industrial techno',
      domains: ['Rhythm', 'Timbre']
    });
    
    // Layer 4: Composition
    const exportConfig: ExportPreset = {
      id: 'linear_export',
      label: 'Linear Export',
      composition: { mode: 'as-is' },
      filters: { includeTags: ['transformed'] }
    };
    
    return this.compositionLayer.generate(built, exportConfig);
  }
}
```

---

### Стратегия 2: Итеративная рефинement (Iterative Refinement)

**Описание:** Циклическое прохождение с обратной связью между Python и Meta слоями.

```
┌──────────────────────────────────────────────────────────┐
│                     ITERATION CYCLE                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Import    │───>│ Python Build│───>│  Evaluate   │  │
│  │   & Tag     │    │   & Mutate  │    │   Score     │  │
│  └─────────────┘    └─────────────┘    └──────┬──────┘  │
│       ↑                                        │         │
│       └────────────────────────────────────────┘         │
│              (Feedback if score < threshold)             │
└──────────────────────────────────────────────────────────┘
```

**Применение:**
- Оптимизация паттернов
- Эволюция стилей
- Достижение целевых метрик

**Код интеграции:**

```typescript
// IterativeRefinementStrategy.ts
export class IterativeRefinementStrategy {
  private maxIterations = 10;
  private scoreThreshold = 0.85;
  
  async execute(
    data: RawJsonData, 
    targetIntent: string
  ): Promise<ExportResult> {
    let currentData = await this.initialProcess(data);
    let bestResult: ExportResult | null = null;
    let bestScore = 0;
    
    for (let i = 0; i < this.maxIterations; i++) {
      // Python processing with feedback
      const result = await this.pythonLayer.build(currentData, {
        intent: targetIntent,
        temperature: this.calculateTemperature(i),
        runs: 8 + (i * 2) // Increase runs with iterations
      });
      
      // Evaluation
      const score = await this.evaluateResult(result, targetIntent);
      
      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
      
      // Check convergence
      if (score >= this.scoreThreshold) {
        console.log(`Converged at iteration ${i} with score ${score}`);
        break;
      }
      
      // Prepare next iteration
      currentData = await this.prepareNextIteration(result, score);
    }
    
    return bestResult!;
  }
  
  private calculateTemperature(iteration: number): number {
    // Decay temperature as we approach solution
    return Math.max(0.2, 0.7 - (iteration * 0.05));
  }
}
```

---

### Стратегия 3: Параллельная эксплорация (Parallel Exploration)

**Описание:** Одновременное выполнение нескольких вариантов с последующим отбором.

```
                    ┌─→ Variant A (high temp) ─┐
                    ├─→ Variant B (medium temp) ─┤
Input ──[Split]────┼─→ Variant C (low temp) ───┼──[Merge]──> Best Result
                    ├─→ Variant D (mmss-v3) ────┤
                    └─→ Variant E (mutation) ───┘
```

**Применение:**
- Исследование пространства решений
- Сравнение стратегий
- Робастные результаты

**Код интеграции:**

```typescript
// ParallelExplorationStrategy.ts
export class ParallelExplorationStrategy {
  private variants: BuildVariant[] = [
    { name: 'Exploration', temperature: 0.8, runs: 4 },
    { name: 'Balanced', temperature: 0.5, runs: 8 },
    { name: 'Precision', temperature: 0.3, runs: 12 },
    { name: 'MMSS-V3', mode: 'mmss-v3', runs: 8 },
    { name: 'Mutation', mode: 'mutation-engine', runs: 6 }
  ];
  
  async execute(data: RawJsonData): Promise<ExportResult> {
    // Layer 1-2: Common preprocessing
    const preprocessed = await this.preprocess(data);
    
    // Layer 3: Parallel Python processing
    const variantPromises = this.variants.map(variant =>
      this.pythonLayer.build(preprocessed, {
        intent: data.intent,
        temperature: variant.temperature,
        runs: variant.runs,
        mode: variant.mode || 'mmss-v3'
      }).then(result => ({
        variant: variant.name,
        result,
        score: this.scoreResult(result)
      }))
    );
    
    const results = await Promise.all(variantPromises);
    
    // Selection strategy
    const best = this.selectBest(results, 'ensemble'); // or 'single-best'
    
    // Layer 4: Compose final export
    return this.compositionLayer.generate(best.result, {
      composition: { mode: 'as-is' }
    });
  }
  
  private selectBest(
    results: VariantResult[], 
    strategy: 'single-best' | 'ensemble'
  ): VariantResult {
    if (strategy === 'single-best') {
      return results.reduce((best, current) =>
        current.score > best.score ? current : best
      );
    }
    
    // Ensemble: merge top 3 variants
    const top3 = results
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    return {
      variant: 'ensemble',
      result: this.mergeResults(top3.map(r => r.result)),
      score: top3.reduce((sum, r) => sum + r.score, 0) / 3
    };
  }
}
```

---

### Стратегия 4: Иерархическая декомпозиция (Hierarchical Decomposition)

**Описание:** Разбиение задачи на подзадачи по доменам MMSS с последующей сборкой.

```
Intent: "Industrial Hypnotic Techno"
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼───┐    ┌────▼────┐    ┌────▼────┐
│ Rhythm│    │  Timbre │    │  Space  │
│ Layer │    │  Layer  │    │  Layer  │
└───┬───┘    └────┬────┘    └────┬────┘
    │               │               │
    └───────────────┼───────────────┘
                    │
            ┌───────▼───────┐
            │  Composition  │
            │    Logic      │
            └───────┬───────┘
                    │
               ┌────▼────┐
               │  Final  │
               │ Export  │
               └─────────┘
```

**Применение:**
- Сложные многослойные композиции
- Специализация по доменам
- Модульное построение

**Код интеграции:**

```typescript
// HierarchicalDecompositionStrategy.ts
export class HierarchicalDecompositionStrategy {
  private domains: Domain[] = ['Rhythm', 'Timbre', 'Space', 'Logic'];
  
  async execute(data: RawJsonData, intent: string): Promise<ExportResult> {
    // Domain-specific processing
    const domainResults = await Promise.all(
      this.domains.map(domain =>
        this.processDomain(data, intent, domain)
      )
    );
    
    // Cross-domain relationship analysis
    const relationships = await this.analyzeRelationships(domainResults);
    
    // Hierarchical assembly
    const assembly = await this.hierarchicalAssembly({
      layers: domainResults,
      relationships,
      compositionRules: this.getCompositionRules(intent)
    });
    
    // Final composition
    return this.compositionLayer.generate(assembly, {
      composition: { 
        mode: 'rule-engine',
        pattern: 'hierarchical-merge'
      }
    });
  }
  
  private async processDomain(
    data: RawJsonData,
    intent: string,
    domain: Domain
  ): Promise<DomainLayer> {
    // Filter data for domain
    const domainData = await this.filterByDomain(data, domain);
    
    // Domain-specific Python processing
    const processed = await this.pythonLayer.build(domainData, {
      intent: `${intent} ${domain}`,
      domains: [domain],
      temperature: 0.5,
      max_blocks: this.getOptimalBlockCount(domain)
    });
    
    return {
      domain,
      blocks: processed.blocks,
      metadata: processed.meta
    };
  }
  
  private async hierarchicalAssembly(config: AssemblyConfig): Promise<BuiltData> {
    // Layer 1: Rhythm (foundation)
    const rhythmLayer = config.layers.find(l => l.domain === 'Rhythm');
    
    // Layer 2: Timbre (synthesis)
    const timbreLayer = config.layers.find(l => l.domain === 'Timbre');
    const rhythmTimbre = await this.mergeLayers(rhythmLayer!, timbreLayer!);
    
    // Layer 3: Space (positioning)
    const spaceLayer = config.layers.find(l => l.domain === 'Space');
    const positioned = await this.mergeLayers(rhythmTimbre, spaceLayer!);
    
    // Layer 4: Logic (structure)
    const logicLayer = config.layers.find(l => l.domain === 'Logic');
    return await this.mergeLayers(positioned, logicLayer!);
  }
}
```

---

### Стратегия 5: Эволюционная оптимизация (Evolutionary Optimization)

**Описание:** Полный цикл с мутациями, отбором и самоэволюцией правил.

```
Generation 1          Generation 2          Generation N
┌───────────┐        ┌───────────┐        ┌───────────┐
│  Parents  │──┬────>│  Children │──┬────>│  Winners  │
└───────────┘  │      └───────────┘  │      └───────────┘
     │         │           │       │           │
     │    ┌────┘      ┌────┘       │      ┌────┘
     │    │           │            │      │
     ▼    ▼           ▼            ▼      ▼
┌────────────────────────────────────────────────────┐
│  Mutation → Crossover → Scoring → Selection → Rules  │
│         ↓                    ↑                      │
│    Self-Rule Engine (evolves selection strategy)   │
└────────────────────────────────────────────────────┘
```

**Применение:**
- Оптимизация долгосрочных паттернов
- Самообучающиеся системы
- Исследование новых стилей

**Код интеграции:**

```typescript
// EvolutionaryOptimizationStrategy.ts
export class EvolutionaryOptimizationStrategy {
  private populationSize = 20;
  private generations = 10;
  private mutationRate = 0.15;
  private crossoverRate = 0.7;
  
  async execute(data: RawJsonData, intent: string): Promise<ExportResult> {
    // Initialize population
    let population = await this.initializePopulation(data, intent);
    
    // Evolution loop
    for (let gen = 0; gen < this.generations; gen++) {
      // Evaluate fitness
      const scored = await this.evaluateFitness(population, intent);
      
      // Selection
      const parents = this.selection(scored, 'tournament');
      
      // Crossover
      const offspring = await this.crossover(parents);
      
      // Mutation
      const mutated = await this.mutate(offspring, this.mutationRate);
      
      // Self-rule evolution
      const rules = await this.evolveRules(scored, gen);
      
      // Create next generation
      population = await this.createNextGeneration(
        parents, 
        mutated, 
        rules
      );
      
      console.log(`Generation ${gen}: best score = ${scored[0].score}`);
    }
    
    // Return best from final generation
    const finalScored = await this.evaluateFitness(population, intent);
    const best = finalScored[0];
    
    return this.compositionLayer.generate(best.individual, {
      composition: { mode: 'mmss-v3' }
    });
  }
  
  private async evolveRules(
    scored: ScoredIndividual[], 
    generation: number
  ): Promise<SelfRules> {
    // Analyze successful patterns
    const successfulPatterns = scored
      .filter(s => s.score > 0.8)
      .map(s => this.extractPatterns(s.individual));
    
    // Generate new rules based on patterns
    const newRules = await this.pythonLayer.runSelfRuleEngine({
      patterns: successfulPatterns,
      generation,
      mutationRate: this.mutationRate * (1 - generation / this.generations)
    });
    
    return newRules;
  }
}
```

---

## Синхронизация между слоями

### Схема синхронизации данных

```typescript
// LayerSyncManager.ts
export class LayerSyncManager {
  // Layer 1 ↔ Layer 2 sync
  async syncImportToMeta(
    imported: ImportResult
  ): Promise<MetaUpdate> {
    return {
      newElements: imported.elements.map(e => ({
        id: e.id,
        tagIds: [], // To be scanned
        raw: e.raw
      })),
      timestamp: Date.now(),
      source: imported.source
    };
  }
  
  // Layer 2 ↔ Layer 3 sync
  async syncMetaToPython(
    meta: MetaState
  ): Promise<PythonInput> {
    return {
      blocks: meta.elementTagBindings.map(binding => ({
        id: binding.elementId,
        tags: binding.tags,
        data: this.getRawData(binding.elementId)
      })),
      tagRegistry: meta.tagRegistry,
      sequences: meta.keySequencePresets
    };
  }
  
  // Layer 3 ↔ Layer 4 sync
  async syncPythonToComposition(
    pythonResult: PythonBuildResult
  ): Promise<CompositionInput> {
    return {
      blocks: pythonResult.blocks,
      metadata: {
        intent: pythonResult.meta.intent,
        score: pythonResult.meta.run_score,
        domains: this.inferDomains(pythonResult.blocks)
      }
    };
  }
  
  // Full pipeline sync
  async fullSync(): Promise<SyncReport> {
    const report: SyncReport = {
      layer1: await this.syncLayer1(),
      layer2: await this.syncLayer2(),
      layer3: await this.syncLayer3(),
      layer4: await this.syncLayer4(),
      consistency: await this.verifyConsistency()
    };
    
    return report;
  }
}
```

---

## Рекомендуемые пайплайны по задачам

### Задача 1: Создание тематической библиотеки

```
Стратегия: Hierarchical Decomposition + Parallel Exploration

Шаги:
1. Import: Загрузка исходных семплов через WebSocket
2. Meta: Автоматическое сканирование и тегирование
3. Python: Параллельная обработка по доменам
   ├─ Rhythm: 4 варианта с разными темпами
   ├─ Timbre: 4 варианта с разными осцилляторами
   ├─ Space: 2 варианта реверберации
   └─ Logic: 2 структурных паттерна
4. Assembly: Иерархическая сборка
5. Export: 64 файла (4×4×2×2)
```

### Задача 2: Оптимизация существующего паттерна

```
Стратегия: Iterative Refinement + Evolutionary

Шаги:
1. Import: Загрузка базового паттерна
2. Meta: Присвоение целевых тегов
3. Python: Итеративная оптимизация
   Generation 1: 20 вариантов
   Generation 2: Мутация лучших 10
   Generation 3: Скрещивание + мутация
   ...
   Generation 10: Финальный отбор
4. Export: Топ-5 лучших результатов
```

### Задача 3: Исследование нового стиля

```
Стратегия: Parallel Exploration + Evolutionary

Шаги:
1. Import: Разнообразные источники
2. Meta: Расширенное тегирование
3. Python: 
   ├─ Exploration: Высокая температура
   ├─ Variants: Множество комбинаций
   └─ Evolution: 20 поколений
4. Analysis: Выявление успешных паттернов
5. Export: Новые правила + лучшие примеры
```

---

## API объединения слоёв

### Unified Pipeline API

```typescript
// UnifiedPipeline.ts
export class UnifiedPipeline {
  constructor(
    private importLayer: ImportLayer,
    private metaLayer: MetaLayer,
    private pythonLayer: PythonLayer,
    private compositionLayer: CompositionLayer,
    private syncManager: LayerSyncManager
  ) {}
  
  async run(
    config: PipelineConfig
  ): Promise<PipelineResult> {
    const { strategy, input, parameters } = config;
    
    // Select strategy
    const strategyImpl = this.getStrategy(strategy);
    
    // Execute with monitoring
    const startTime = Date.now();
    
    try {
      const result = await strategyImpl.execute(input, parameters);
      
      // Sync all layers
      await this.syncManager.fullSync();
      
      return {
        success: true,
        data: result,
        metrics: {
          duration: Date.now() - startTime,
          layersProcessed: 4,
          itemsGenerated: result.count
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        partialResults: await this.recoverPartialResults()
      };
    }
  }
  
  private getStrategy(type: StrategyType): CompositionStrategy {
    const strategies: Record<StrategyType, CompositionStrategy> = {
      'linear': new LinearCompositionStrategy(),
      'iterative': new IterativeRefinementStrategy(),
      'parallel': new ParallelExplorationStrategy(),
      'hierarchical': new HierarchicalDecompositionStrategy(),
      'evolutionary': new EvolutionaryOptimizationStrategy()
    };
    
    return strategies[type];
  }
}

// Usage
const pipeline = new UnifiedPipeline(
  importLayer,
  metaLayer,
  pythonLayer,
  compositionLayer,
  syncManager
);

const result = await pipeline.run({
  strategy: 'hierarchical',
  input: rawJsonData,
  parameters: {
    intent: 'industrial hypnotic techno',
    domains: ['Rhythm', 'Timbre', 'Space'],
    exportCount: 16
  }
});
```

---

## Мониторинг и отладка

### Pipeline Metrics Dashboard

```typescript
// PipelineMetrics.ts
export interface PipelineMetrics {
  // Layer 1: Import
  importCount: number;
  importSpeed: number; // items/sec
  websocketLatency: number;
  
  // Layer 2: Meta
  tagCoverage: number; // % elements tagged
  sequenceCount: number;
  registrySize: number;
  
  // Layer 3: Python
  buildTime: number;
  mutationRate: number;
  averageScore: number;
  convergenceRate: number;
  
  // Layer 4: Composition
  exportCount: number;
  filterEfficiency: number;
  fileSizeDistribution: number[];
}

export class PipelineMonitor {
  private metrics: PipelineMetrics[] = [];
  
  record(metrics: PipelineMetrics) {
    this.metrics.push({
      ...metrics,
      timestamp: Date.now()
    });
    
    // Alert on anomalies
    if (metrics.averageScore < 0.5) {
      this.alert('Low average score detected');
    }
    
    if (metrics.convergenceRate < 0.1) {
      this.alert('Slow convergence - consider adjusting temperature');
    }
  }
  
  getRecommendations(): string[] {
    const latest = this.metrics[this.metrics.length - 1];
    const recommendations: string[] = [];
    
    if (latest.tagCoverage < 0.8) {
      recommendations.push(
        'Increase tag coverage: run additional scanning'
      );
    }
    
    if (latest.buildTime > 30000) {
      recommendations.push(
        'Optimize build time: reduce max_blocks or runs'
      );
    }
    
    return recommendations;
  }
}
```

---

## Заключение

Этот документ описывает пять стратегий объединения слоёв Prompt DB Local:

1. **Linear** — быстро и предсказуемо
2. **Iterative** — оптимизация через обратную связь
3. **Parallel** — исследование вариантов
4. **Hierarchical** — сложные многослойные композиции
5. **Evolutionary** — самообучающиеся системы

Выбор стратегии зависит от задачи:
- Для быстрых задач: **Linear**
- Для оптимизации: **Iterative**
- Для исследования: **Parallel** или **Evolutionary**
- Для сложных композиций: **Hierarchical**

Все стратегии доступны через UnifiedPipeline API с полным мониторингом и синхронизацией между слоями.
