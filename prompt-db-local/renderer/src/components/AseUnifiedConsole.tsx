import { useMemo, useState } from 'react';
import type { AseModeDefinition } from '@/types/aseConsole';

const ASE_MODES: AseModeDefinition[] = [
  {
    id: 'entropy-modulator',
    name: 'Entropy Modulator',
    shortName: 'Entropy',
    category: 'Core',
    description: 'Базовый модуль управления P/C pad и ядром энтропии.',
    tip: 'Используйте как стартовый режим, когда нужно быстро задать характер генерации без перегруза параметрами.',
    tags: ['энтропия', 'core', 'pad-control', 'seed'],
    controls: [
      {
        key: 'entropyP',
        label: 'Entropy P',
        type: 'knob',
        defaultValue: '0.618',
        description: 'Плотность первичного импульса.',
        tip: 'Чем выше значение, тем смелее и резче стартовый материал.',
        tags: ['энтропия', 'плотность'],
      },
      {
        key: 'entropyC',
        label: 'Entropy C',
        type: 'knob',
        defaultValue: '0.382',
        description: 'Степень управляемого хаоса.',
        tip: 'Держите ниже P, если нужна читаемая структура.',
        tags: ['хаос', 'контроль'],
      },
      {
        key: 'padLink',
        label: 'P/C Pad Link',
        type: 'toggle',
        defaultValue: 'linked',
        description: 'Связка двух осей пад-контроля.',
        tip: 'Связанный режим удобен для живой игры, раздельный для тонкой ручной настройки.',
        tags: ['pad', 'performance'],
      },
    ],
    fragment: {
      consoleId: 'ase.entropy.core',
      output: {
        stage: 'pre-shaping',
        engine: 'entropy-kernel',
        result: 'base modulation profile',
      },
      merge: {
        source: 'hybrid',
        strategy: 'db-seed + runtime-entropy',
      },
    },
  },
  {
    id: 'modulator-rack',
    name: 'Modulator Rack',
    shortName: 'Rack',
    category: 'Extension',
    description: 'Расширенный рэк модуляторов с gravity и LFE-цепью.',
    tip: 'Подключайте после Entropy Modulator, когда нужна глубина, масса и движение по низам.',
    tags: ['rack', 'lfe', 'gravity', 'movement'],
    controls: [
      {
        key: 'gravityDrive',
        label: 'Gravity Drive',
        type: 'slider',
        defaultValue: '72%',
        description: 'Притяжение и вес модуляции.',
        tip: 'Поднимает ощущение массы, но может перегружать микс, если увлечься.',
        tags: ['гравитация', 'вес'],
      },
      {
        key: 'lfeSync',
        label: 'LFE Sync',
        type: 'select',
        defaultValue: '1/2 bar',
        description: 'Привязка низкочастотного движения ко времени.',
        tip: 'Для кача лучше короткая сетка, для атмосферы лучше длинная.',
        tags: ['lfe', 'sync'],
      },
      {
        key: 'modDepth',
        label: 'Depth',
        type: 'knob',
        defaultValue: '0.74',
        description: 'Общая глубина модуляции.',
        tip: 'Используйте как главный макро-регулятор динамики.',
        tags: ['depth', 'macro'],
      },
    ],
    fragment: {
      consoleId: 'ase.modrack.extended',
      output: {
        stage: 'macro-motion',
        engine: 'gravity-lfo-cluster',
        result: 'low-end movement map',
      },
      merge: {
        source: 'logic',
        strategy: 'append modulation lanes',
      },
    },
  },
  {
    id: 'ase-v4-infinity',
    name: 'ASE v4 Infinity',
    shortName: 'v4 Infinity',
    category: 'Advanced',
    description: 'Продвинутый режим v4 с Phi-Sync и расширенной связностью.',
    tip: 'Нужен, когда вы хотите собрать более “умный” паттерн из нескольких режимов и зафиксировать общую логику.',
    tags: ['v4', 'phi-sync', 'advanced', 'structure'],
    controls: [
      {
        key: 'phiSync',
        label: 'Phi Sync',
        type: 'toggle',
        defaultValue: 'enabled',
        description: 'Синхронизация по золотому отношению.',
        tip: 'Полезно для органичного ритма и повторов без ощущения “ровной сетки”.',
        tags: ['phi', 'sync'],
      },
      {
        key: 'infinitySpread',
        label: 'Infinity Spread',
        type: 'slider',
        defaultValue: '61.8%',
        description: 'Развод слоёв в пространстве и логике.',
        tip: 'Повышает разницу между слоями, чтобы режимы не звучали одинаково.',
        tags: ['spread', 'layers'],
      },
      {
        key: 'recursionGuard',
        label: 'Recursion Guard',
        type: 'toggle',
        defaultValue: 'active',
        description: 'Контроль рекурсивных связей.',
        tip: 'Не даёт мастеру уйти в бесконтрольное самокопирование.',
        tags: ['guard', 'recursion'],
      },
    ],
    fragment: {
      consoleId: 'ase.v4.infinity',
      output: {
        stage: 'structural-sync',
        engine: 'phi-bridge',
        result: 'harmonic routing graph',
      },
      merge: {
        source: 'hybrid',
        strategy: 'normalize fragments by phi clock',
      },
    },
  },
  {
    id: 'ase-monitor-supreme',
    name: 'ASE Monitor Supreme',
    shortName: 'Monitor Supreme',
    category: 'Monitoring',
    description: 'Главная мониторинговая консоль для состояния движка и формул.',
    tip: 'Подходит как обзорный режим: что происходит, где перекос, какой режим доминирует.',
    tags: ['monitor', 'telemetry', 'diagnostics', 'supreme'],
    controls: [
      {
        key: 'formulaBus',
        label: 'Formula Bus',
        type: 'meter',
        defaultValue: 'live',
        description: 'Поток формул и вычислений.',
        tip: 'Используйте как окно наблюдения, а не как источник решения.',
        tags: ['формулы', 'мониторинг'],
      },
      {
        key: 'alertThreshold',
        label: 'Alert Threshold',
        type: 'slider',
        defaultValue: '0.82',
        description: 'Порог сигналов тревоги.',
        tip: 'Ниже порог - больше уведомлений о нестабильности.',
        tags: ['alert', 'threshold'],
      },
      {
        key: 'focusNode',
        label: 'Focus Node',
        type: 'select',
        defaultValue: 'master-output',
        description: 'Главная точка наблюдения.',
        tip: 'Ставьте на master-output, если нужно понять итог, а не причину.',
        tags: ['node', 'focus'],
      },
    ],
    fragment: {
      consoleId: 'ase.monitor.supreme',
      output: {
        stage: 'observation',
        engine: 'telemetry-grid',
        result: 'stability and alert snapshot',
      },
      merge: {
        source: 'database',
        strategy: 'attach monitoring overlays',
      },
    },
  },
  {
    id: 'aase-monitor-update',
    name: 'AASE Monitor Update',
    shortName: 'Monitor Update',
    category: 'Monitoring',
    description: 'Обновлённый omega-мониторинг с формульной подпиткой.',
    tip: 'Используйте как “умное продолжение” Supreme, если нужен более формальный разбор состояния.',
    tags: ['omega', 'monitoring', 'update', 'formulas'],
    controls: [
      {
        key: 'omegaBias',
        label: 'Omega Bias',
        type: 'knob',
        defaultValue: '0.44',
        description: 'Вес omega-мониторинга в итоговой сводке.',
        tip: 'Полезно для систем, где важнее устойчивость, чем агрессия.',
        tags: ['omega', 'bias'],
      },
      {
        key: 'formulaAssist',
        label: 'Formula Assist',
        type: 'toggle',
        defaultValue: 'enabled',
        description: 'Добавление вычислительных подсказок.',
        tip: 'Показывает причины, почему система считает состояние проблемным.',
        tags: ['assist', 'formula'],
      },
      {
        key: 'summaryMode',
        label: 'Summary Mode',
        type: 'select',
        defaultValue: 'russian-short',
        description: 'Формат короткой сводки.',
        tip: 'Хорошо подходит для быстрого чтения прямо в единой панели.',
        tags: ['summary', 'ui'],
      },
    ],
    fragment: {
      consoleId: 'aase.monitor.update',
      output: {
        stage: 'analysis',
        engine: 'omega-formula-trace',
        result: 'annotated monitoring digest',
      },
      merge: {
        source: 'hybrid',
        strategy: 'merge alerts with formula commentary',
      },
    },
  },
  {
    id: 'audio-decomposer',
    name: 'Audio Decomposer',
    shortName: 'Decomposer',
    category: 'Audio',
    description: 'Спектральный анализатор аудио в реальном времени с синхронизацией.',
    tip: 'Включайте, когда панель должна понимать не только логику, но и фактический звук.',
    tags: ['audio', 'spectral', 'analysis', 'sync'],
    controls: [
      {
        key: 'spectralWindow',
        label: 'Spectral Window',
        type: 'select',
        defaultValue: '4096 FFT',
        description: 'Размер окна спектрального анализа.',
        tip: 'Большое окно точнее по частотам, но медленнее по реакции.',
        tags: ['fft', 'spectrum'],
      },
      {
        key: 'transientLock',
        label: 'Transient Lock',
        type: 'toggle',
        defaultValue: 'on',
        description: 'Фиксация транзиентов для синхронизации.',
        tip: 'Полезно, если режимы должны реагировать на атаку, а не на общий шум.',
        tags: ['transient', 'timing'],
      },
      {
        key: 'syncSource',
        label: 'Sync Source',
        type: 'select',
        defaultValue: 'master-clock',
        description: 'Источник времени для анализа.',
        tip: 'Единый clock важен, если вы собираете много режимов в один JSON.',
        tags: ['clock', 'sync'],
      },
    ],
    fragment: {
      consoleId: 'audio.decomposer.rt',
      output: {
        stage: 'audio-intake',
        engine: 'spectral-slicer',
        result: 'frequency event map',
      },
      merge: {
        source: 'logic',
        strategy: 'inject audio markers into output graph',
      },
    },
  },
  {
    id: 'ai-orchestrator',
    name: 'AI Orchestrator',
    shortName: 'AI Orchestrator',
    category: 'AI',
    description: 'Интеграция с Mistral AI и генерацией правил.',
    tip: 'Это слой, который помогает не просто хранить режимы, а договаривать их между собой автоматически.',
    tags: ['ai', 'mistral', 'rules', 'orchestration'],
    controls: [
      {
        key: 'ruleGeneration',
        label: 'Rule Generation',
        type: 'toggle',
        defaultValue: 'auto',
        description: 'Автогенерация правил для выбранных режимов.',
        tip: 'Удобно, когда конфигурация большая и вы не хотите вручную описывать связи.',
        tags: ['rules', 'automation'],
      },
      {
        key: 'modelProfile',
        label: 'Model Profile',
        type: 'select',
        defaultValue: 'balanced',
        description: 'Профиль ИИ-модели для orchestration.',
        tip: 'Balanced подходит по умолчанию; aggressive лучше для смелых комбинаций.',
        tags: ['model', 'profile'],
      },
      {
        key: 'conflictPolicy',
        label: 'Conflict Policy',
        type: 'select',
        defaultValue: 'explain-and-merge',
        description: 'Разбор конфликтов между режимами.',
        tip: 'Хороший вариант для плагинной архитектуры, где режимы могут спорить друг с другом.',
        tags: ['merge', 'conflict'],
      },
    ],
    fragment: {
      consoleId: 'ai.orchestrator.rules',
      output: {
        stage: 'reasoning',
        engine: 'mistral-rule-synth',
        result: 'rule pack and mode relationships',
      },
      merge: {
        source: 'hybrid',
        strategy: 'resolve console conflicts with AI rules',
      },
    },
  },
  {
    id: 'generation-engine',
    name: 'Generation Engine',
    shortName: 'Generation',
    category: 'Engine',
    description: 'Python-система генерации блоков и исполнения MMSS-логики.',
    tip: 'Нужна как “движок исполнения”: панель выбирает режимы, а этот блок реально собирает output.',
    tags: ['python', 'generation', 'blocks', 'runtime'],
    controls: [
      {
        key: 'runCount',
        label: 'Run Count',
        type: 'slider',
        defaultValue: '4',
        description: 'Количество прогонов генерации.',
        tip: 'Больше прогонов - больше вариантов, но медленнее ответ.',
        tags: ['runs', 'generation'],
      },
      {
        key: 'mutationPolicy',
        label: 'Mutation Policy',
        type: 'select',
        defaultValue: 'safe-divergence',
        description: 'Правило мутаций для блоков.',
        tip: 'Safe Divergence даёт новые варианты без полного распада структуры.',
        tags: ['mutation', 'policy'],
      },
      {
        key: 'exportShape',
        label: 'Export Shape',
        type: 'select',
        defaultValue: 'mmss-json',
        description: 'Формат итоговой сборки.',
        tip: 'Держите `mmss-json`, если это будет мастер-формат для всей системы.',
        tags: ['export', 'json'],
      },
    ],
    fragment: {
      consoleId: 'generation.engine.python',
      output: {
        stage: 'execution',
        engine: 'mmss-builder-v3',
        result: 'generated block bundle',
      },
      merge: {
        source: 'logic',
        strategy: 'compose final block output',
      },
    },
  },
  {
    id: 'flowmusic-app-archiver',
    name: 'FlowMusic.app Archiver',
    shortName: 'Archiver',
    category: 'Archive',
    description: 'Архиватор музыкальных библиотек и мультиаккаунтных коллекций.',
    tip: 'Полезен как финальный служебный режим: сохранить результат, контекст и происхождение сборки.',
    tags: ['archive', 'flowmusic', 'library', 'accounts'],
    controls: [
      {
        key: 'accountScope',
        label: 'Account Scope',
        type: 'select',
        defaultValue: 'all-linked',
        description: 'Какие аккаунты включать в архив.',
        tip: 'Если тестируете, ограничьте scope одним аккаунтом, чтобы не раздувать экспорт.',
        tags: ['accounts', 'scope'],
      },
      {
        key: 'manifestMode',
        label: 'Manifest Mode',
        type: 'toggle',
        defaultValue: 'on',
        description: 'Создание manifest рядом с архивом.',
        tip: 'Очень желательно оставить включённым, чтобы потом понимать происхождение JSON.',
        tags: ['manifest', 'archive'],
      },
      {
        key: 'retentionPolicy',
        label: 'Retention',
        type: 'select',
        defaultValue: 'keep-last-5',
        description: 'Политика хранения архивов.',
        tip: 'Помогает не засорять storage историей однотипных сборок.',
        tags: ['retention', 'storage'],
      },
    ],
    fragment: {
      consoleId: 'flowmusic.archiver.multi',
      output: {
        stage: 'archive',
        engine: 'library-collector',
        result: 'manifest and backup package',
      },
      merge: {
        source: 'database',
        strategy: 'attach archive metadata to final json',
      },
    },
  },
];

const DEFAULT_SELECTED = [
  'entropy-modulator',
  'generation-engine',
  'ai-orchestrator',
];

export function AseUnifiedConsole() {
  const [activeModeId, setActiveModeId] = useState<string>(ASE_MODES[0]?.id ?? '');
  const [selectedModeIds, setSelectedModeIds] = useState<string[]>(DEFAULT_SELECTED);

  const activeMode = ASE_MODES.find((mode) => mode.id === activeModeId) ?? ASE_MODES[0];

  const selectedModes = useMemo(
    () => ASE_MODES.filter((mode) => selectedModeIds.includes(mode.id)),
    [selectedModeIds],
  );

  const allTags = useMemo(
    () => Array.from(new Set(selectedModes.flatMap((mode) => mode.tags))).sort((a, b) => a.localeCompare(b)),
    [selectedModes],
  );

  const composedConfig = useMemo(
    () => ({
      schema: 'mmss-unified-console',
      version: '1.0.0',
      ui: {
        concept: 'Ableton + VST style unified rack',
        locale: 'ru-RU',
        selectedModeCount: selectedModes.length,
      },
      masterConsole: {
        id: 'ase-unified-console',
        name: 'ASE Unified Console',
        description: 'Единая панель для вызова режимов и сборки общего MMSS JSON.',
      },
      tags: allTags,
      modes: selectedModes.map((mode, index) => ({
        order: index + 1,
        id: mode.id,
        name: mode.name,
        category: mode.category,
        description: mode.description,
        tip: mode.tip,
        tags: mode.tags,
        controls: mode.controls.map((control) => ({
          key: control.key,
          label: control.label,
          type: control.type,
          defaultValue: control.defaultValue,
          description: control.description,
          tip: control.tip,
          tags: control.tags,
        })),
        fragment: mode.fragment,
      })),
      outputPipeline: selectedModes.map((mode) => ({
        modeId: mode.id,
        consoleId: mode.fragment.consoleId,
        stage: mode.fragment.output.stage,
        engine: mode.fragment.output.engine,
        result: mode.fragment.output.result,
        mergeSource: mode.fragment.merge.source,
        mergeStrategy: mode.fragment.merge.strategy,
      })),
      mergePlan: {
        database: selectedModes
          .filter((mode) => mode.fragment.merge.source !== 'logic')
          .map((mode) => mode.id),
        logic: selectedModes
          .filter((mode) => mode.fragment.merge.source !== 'database')
          .map((mode) => mode.id),
        output: 'Fragments are composed into one MMSS JSON and executed through the shared output pipeline.',
      },
    }),
    [allTags, selectedModes],
  );

  const toggleMode = (modeId: string) => {
    setSelectedModeIds((current) =>
      current.includes(modeId) ? current.filter((id) => id !== modeId) : [...current, modeId],
    );
  };

  const selectAll = () => {
    setSelectedModeIds(ASE_MODES.map((mode) => mode.id));
  };

  const clearSelection = () => {
    setSelectedModeIds([]);
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(composedConfig, null, 2));
    } catch (error) {
      console.error('Failed to copy unified console JSON', error);
    }
  };

  return (
    <div className="ase-console">
      <div className="ase-console__hero">
        <div>
          <p className="eyebrow">ASE / MMSS</p>
          <h3>Unified master panel для режимов, тегов и JSON-фрагментов</h3>
          <p className="hero-copy compact-copy">
            Каждый режим можно вызвать из одной панели, а выбранные режимы собираются в единый
            `MMSS JSON` со слоями базы, логики и итогового `output`.
          </p>
        </div>

        <div className="ase-console__actions">
          <button className="secondary-button" onClick={selectAll} type="button">
            Выбрать всё
          </button>
          <button className="secondary-button" onClick={clearSelection} type="button">
            Очистить
          </button>
          <button className="primary-button" onClick={() => void copyJson()} type="button">
            Копировать JSON
          </button>
        </div>
      </div>

      <div className="ase-console__summary">
        <div className="ase-summary-card">
          <span>Режимов выбрано</span>
          <strong>{selectedModes.length}</strong>
        </div>
        <div className="ase-summary-card">
          <span>Уникальных тегов</span>
          <strong>{allTags.length}</strong>
        </div>
        <div className="ase-summary-card">
          <span>Архитектура</span>
          <strong>JSON Plugin Rack</strong>
        </div>
      </div>

      <div className="ase-console__layout">
        <aside className="ase-sidebar">
          <div className="ase-sidebar__header">
            <h4>Режимы</h4>
            <span>{ASE_MODES.length} модулей</span>
          </div>

          <div className="ase-mode-list">
            {ASE_MODES.map((mode) => {
              const isSelected = selectedModeIds.includes(mode.id);
              const isActive = activeMode.id === mode.id;

              return (
                <button
                  key={mode.id}
                  className={`ase-mode-card${isActive ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                  onClick={() => setActiveModeId(mode.id)}
                  type="button"
                >
                  <div className="ase-mode-card__top">
                    <div>
                      <strong>{mode.name}</strong>
                      <span>{mode.category}</span>
                    </div>
                    <input
                      aria-label={`Включить ${mode.name}`}
                      checked={isSelected}
                      onChange={() => toggleMode(mode.id)}
                      onClick={(event) => event.stopPropagation()}
                      type="checkbox"
                    />
                  </div>
                  <p>{mode.description}</p>
                  <div className="tag-chip-row">
                    {mode.tags.slice(0, 3).map((tag) => (
                      <span className="tag-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="ase-detail">
          <div className="ase-detail__header">
            <div>
              <p className="eyebrow">{activeMode.category}</p>
              <h4>{activeMode.name}</h4>
              <p className="panel-copy">{activeMode.description}</p>
            </div>
            <div className="ase-inline-badge">
              <span>Tip</span>
              <strong>{activeMode.tip}</strong>
            </div>
          </div>

          <div className="tag-chip-row tag-chip-row-spaced">
            {activeMode.tags.map((tag) => (
              <span className="tag-chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <div className="ase-control-grid">
            {activeMode.controls.map((control) => (
              <article className="ase-control-card" key={control.key}>
                <div className="ase-control-card__head">
                  <div>
                    <strong>{control.label}</strong>
                    <span>{control.type}</span>
                  </div>
                  <code>{control.defaultValue}</code>
                </div>
                <p>{control.description}</p>
                <div className="ase-tip-box">
                  <strong>Подсказка</strong>
                  <span>{control.tip}</span>
                </div>
                <div className="tag-chip-row">
                  {control.tags.map((tag) => (
                    <span className="tag-chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="ase-fragment-grid">
            <article className="ase-fragment-card">
              <h5>Фрагмент режима</h5>
              <p>
                <strong>Console ID:</strong> <code>{activeMode.fragment.consoleId}</code>
              </p>
              <p>
                <strong>Output:</strong> {activeMode.fragment.output.stage} / {activeMode.fragment.output.engine}
              </p>
              <p>
                <strong>Результат:</strong> {activeMode.fragment.output.result}
              </p>
            </article>

            <article className="ase-fragment-card">
              <h5>Слияние с общим JSON</h5>
              <p>
                <strong>Источник:</strong> {activeMode.fragment.merge.source}
              </p>
              <p>
                <strong>Стратегия:</strong> {activeMode.fragment.merge.strategy}
              </p>
              <p>
                <strong>Смысл:</strong> режим отдаёт свой фрагмент в общую мастер-сборку.
              </p>
            </article>
          </div>
        </section>
      </div>

      <div className="ase-json-panel">
        <div className="ase-json-panel__header">
          <div>
            <h4>MMSS Unified JSON</h4>
            <p className="panel-copy">
              Общий конфиг для “плагинной” панели: выбранные режимы, русские подсказки, теги и
              логика объединения базы с `output`.
            </p>
          </div>
          <span className="badge">{selectedModes.length} fragments</span>
        </div>
        <pre>{JSON.stringify(composedConfig, null, 2)}</pre>
      </div>
    </div>
  );
}

export default AseUnifiedConsole;
