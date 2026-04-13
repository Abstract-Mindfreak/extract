/**
 * Tooltip Helper System for Prompt DB Local
 * 
 * Предоставляет детальные подсказки с примерами для каждого поля UI
 * и цветовой пошаговый подсказчик эффективных действий
 */

import React, { useState, useCallback } from 'react';

// ============================================================================
// ТИПЫ ПОДСКАЗОК
// ============================================================================

export type TooltipCategory = 
  | 'tag-registry'      // Реестр тегов
  | 'sequence-presets'  // Пресеты последовательностей  
  | 'export-composer'   // Композитор экспортов
  | 'mmss-runtime'      // MMSS Python runtime
  | 'import-panel';     // Панель импорта

export interface FieldTooltip {
  field: string;
  label: string;
  description: string;
  examples: string[];  // Минимум 10 примеров
  proTips: string[];
  relatedFields?: string[];
  pipelineStage: number; // 1-4 этап пайплайна
}

export interface PipelineStep {
  stage: number;
  title: string;
  description: string;
  actions: string[];
  effectiveness: 'high' | 'medium' | 'low';
  color: string;
  icon: string;
}

// ============================================================================
// ПОДСКАЗКИ ДЛЯ TAG & KEY EXPLORER
// ============================================================================

export const tagRegistryTooltips: FieldTooltip[] = [
  {
    field: 'manualLabel',
    label: 'Manual tag label',
    description: 'Семантический тег для категоризации JSON элементов. Используется для создания осмысленных групп данных.',
    examples: [
      'kick transient geometry - для ударных с характерной атакой',
      'pad ambient texture - для фоновых пэдов',
      'bass sub frequency - для низкочастотных басов',
      'rhythmic glitch pattern - для глитч-ритмов',
      'melodic sequence major - для мажорных последовательностей',
      'noise industrial layer - для индустриального шума',
      'reverb hall effect - для реверберации',
      'delay feedback loop - для эффектов дилея',
      'filter cutoff automation - для автоматизации фильтров',
      'lfo modulation source - для LFO-модуляции',
      'envelope adsr shape - для огибающих',
      'oscillator waveform - для типов волн'
    ],
    proTips: [
      'Используйте иерархическую структуру: domain + type + attribute',
      'Добавляйте частотные характеристики для аудио-тегов',
      'Включайте эмоциональный контекст: dark, bright, aggressive, calm'
    ],
    relatedFields: ['tagType', 'tagColor'],
    pipelineStage: 2
  },
  {
    field: 'tagType',
    label: 'Tag type',
    description: 'Тип тега определяет его происхождение и использование в системе.',
    examples: [
      'key - тег основан на ключе JSON (например, "frequency", "amplitude")',
      'value - тег основан на значении (например, "440Hz", "sine")',
      'semantic - семантический тег создан вручную (например, "bass heavy")',
      'key - структурный ключ объекта',
      'value - нормализованное строковое значение',
      'semantic - концептуальная категория',
      'key - поле конфигурации',
      'value - параметр настройки',
      'semantic - стиль или жанр',
      'key - метаданные',
      'value - числовой параметр',
      'semantic - эмоциональный окрас'
    ],
    proTips: [
      'Key-теги автоматически создаются при сканировании',
      'Semantic-теги дают максимальную гибкость категоризации',
      'Value-теги полезны для быстрого фильтра по конкретным значениям'
    ],
    relatedFields: ['manualLabel', 'tagColor'],
    pipelineStage: 2
  },
  {
    field: 'scannedKeys',
    label: 'Scanned keys',
    description: 'Ключи JSON, найденные при сканировании базы данных. Частота показывает распространенность.',
    examples: [
      'frequency - встречается в 85% аудио-блоков',
      'amplitude - громкость/амплитуда сигнала',
      'waveform - тип волны (sine, square, saw)',
      'attack - время атаки огибающей',
      'decay - время спада огибающей',
      'sustain - уровень sustain',
      'release - время релиза',
      'modulation - параметры модуляции',
      'filter - параметры фильтрации',
      'resonance - резонанс фильтра',
      'cutoff - частота среза',
      'env_type - тип огибающей'
    ],
    proTips: [
      'Сортируйте по частоте для выявления доминирующих паттернов',
      'Ключи с высокой частотой — кандидаты на автоматические теги',
      'Редкие ключи могут содержать уникальные характеристики'
    ],
    relatedFields: ['scannedValues', 'manualLabel'],
    pipelineStage: 2
  },
  {
    field: 'scannedValues',
    label: 'Scanned values',
    description: 'Нормализованные значения, найденные в JSON. Используются для категоризации по содержимому.',
    examples: [
      'sine - синусоидальная волна',
      'square - меандровая волна',
      'sawtooth - пилообразная волна',
      'triangle - треугольная волна',
      'exponential - экспоненциальная огибающая',
      'linear - линейная огибающая',
      'lowpass - низкочастотный фильтр',
      'highpass - высокочастотный фильтр',
      'bandpass - полосовой фильтр',
      'notch - режекторный фильтр',
      'on - включено/активно',
      'off - выключено/неактивно',
      'auto - автоматический режим'
    ],
    proTips: [
      'Значения нормализуются к нижнему регистру без пробелов',
      'Числовые значения группируются в диапазоны',
      'Используйте value-теги для быстрой фильтрации по типу'
    ],
    relatedFields: ['scannedKeys', 'tagType'],
    pipelineStage: 2
  }
];

// ============================================================================
// ПОДСКАЗКИ ДЛЯ SEQUENCE PRESETS
// ============================================================================

export const sequencePresetsTooltips: FieldTooltip[] = [
  {
    field: 'presetName',
    label: 'Preset name',
    description: 'Название пресета последовательностей для повторного использования в композиторе.',
    examples: [
      'Drum Pattern Standard - стандартные паттерны ударных',
      'Bass Sequence Dark - темные басовые последовательности',
      'Melody Major 7th - мажорные септаккорды',
      'FX Glitch Chain - цепочка глитч-эффектов',
      'Ambient Pad Layers - слои фоновых пэдов',
      'Riser Build Up - нарастающие ризеры',
      'Drop Impact Set - набор ударных для дропа',
      'Percussion Ethnic - этническая перкуссия',
      'Synth Arpeggio Fast - быстрые арпеджио',
      'Vocal Chop Rhythmic - ритмичные вокальные чопы',
      'Transition Sweep FX - FX для переходов',
      'Kick Variation Pack - вариации кика'
    ],
    proTips: [
      'Включайте категорию и подкатегорию в название',
      'Используйте существующие паттерны из вашей музыкальной практики',
      'Добавляйте версионирование: v1, v2 для эволюции пресетов'
    ],
    relatedFields: ['generationMode', 'presetDescription'],
    pipelineStage: 2
  },
  {
    field: 'generationMode',
    label: 'Generation mode',
    description: 'Режим выбора элементов при генерации экспорта на основе этого пресета.',
    examples: [
      'random - случайный выбор из доступных элементов',
      'weighted - выбор с учетом частоты использования',
      'sequential - строгий порядок следования',
      'random - подходит для экспериментальных комбинаций',
      'weighted - предпочитает проверенные элементы',
      'sequential - сохраняет структуру паттерна',
      'random - генерирует неожиданные сочетания',
      'weighted - баланс между новым и проверенным',
      'sequential - для строгих музыкальных форм',
      'random - для генеративной музыки',
      'weighted - для эволюции существующих паттернов',
      'sequential - для детерминированных результатов'
    ],
    proTips: [
      'Random лучше для ранних стадий исследования',
      'Weighted оптимален для боевых паттернов',
      'Sequential необходим для структурированных композиций'
    ],
    relatedFields: ['presetName', 'maxBlocksPerElement'],
    pipelineStage: 3
  },
  {
    field: 'keySequence',
    label: 'Key sequence',
    description: 'Цепочка ключей JSON, определяющая структуру извлечения данных.',
    examples: [
      'oscillator.frequency - путь к частоте осциллятора',
      'envelope.attack - путь к времени атаки',
      'filter.type - тип фильтра в цепочке',
      'lfo.rate - скорость LFO',
      'effects.reverb.wet - уровень реверба',
      'modulation.source - источник модуляции',
      'sequencer.steps - шаги секвенсора',
      'mixer.channel_1.gain - громкость канала',
      'output.master.limit - лимитер на выходе',
      'midi.note.velocity - velocity MIDI ноты',
      'timing.bpm - темп в BPM',
      'sync.clock.source - источник синхронизации'
    ],
    proTips: [
      'Длинные последовательности дают точный контроль',
      'Короткие последовательности более гибкие',
      'Используйте общие префиксы для группировки'
    ],
    relatedFields: ['presetName', 'generationMode'],
    pipelineStage: 2
  }
];

// ============================================================================
// ПОДСКАЗКИ ДЛЯ EXPORT COMPOSER
// ============================================================================

export const exportComposerTooltips: FieldTooltip[] = [
  {
    field: 'presetLabel',
    label: 'Preset label',
    description: 'Название пресета экспорта. Определяет папку и файлы результата.',
    examples: [
      'Techno Pack Industrial - индустриальный техно набор',
      'Ambient Collection v2 - обновленная коллекция эмбиента',
      'Drum Kit Minimal - минималистичный набор ударных',
      'Bass Sounds Dubstep - басовые звуки для дабстепа',
      'Synth Leads Analog - аналоговые синтезаторные лиды',
      'FX Collection Cinematic - кинематографические эффекты',
      'Vocal Chops House - вокальные чопы для хауса',
      'Percussion Latin - латинская перкуссия',
      'Pads Atmospheric - атмосферные пэды',
      'Textures Granular - гранулярные текстуры',
      'One Shots Complete - полный набор one-shot семплов',
      'Loops Breakbeat - брейкбитные лупы'
    ],
    proTips: [
      'Включайте жанр и поджанр в название',
      'Добавляйте версию для отслеживания эволюции',
      'Используйте дату в формате YYYYMMDD для сортировки'
    ],
    relatedFields: ['compositionMode', 'fileNamePattern'],
    pipelineStage: 4
  },
  {
    field: 'compositionMode',
    label: 'Composition mode',
    description: 'Алгоритм генерации финального JSON из отфильтрованных элементов.',
    examples: [
      'as-is - прямой экспорт без модификаций',
      'random-mix - случайное смешивание выбранных элементов',
      'sequence-based - сборка по ключевым последовательностям',
      'mmss-v3 - семантический поиск с AI-скорингом',
      'rule-engine - генерация на основе правил композиции',
      'self-rule-engine - самоэволюция правил генерации',
      'mutation-engine - генерация через мутации блоков',
      'mmss-v4 - расширенная версия с графом связей',
      'F-Final - финальная версия алгоритма',
      'as-is - для быстрого дампа без обработки',
      'random-mix - для экспериментальных комбинаций',
      'sequence-based - для структурированных результатов'
    ],
    proTips: [
      'as-is быстрее всего, но без интеллекта',
      'mmss-v3 дает лучшие результаты для сложных запросов',
      'mutation-engine создает вариации существующих паттернов'
    ],
    relatedFields: ['pattern', 'includeTags'],
    pipelineStage: 4
  },
  {
    field: 'pattern',
    label: 'Pattern',
    description: 'Шаблон генерации: количество файлов × элементов и стратегия выбора.',
    examples: [
      '3x12 random - 3 файла по 12 элементов, случайно',
      '1x50 weighted - 1 файл, 50 элементов, по весу',
      '6x8 sequential - 6 файлов по 8 элементов, последовательно',
      '10x5 mmss-v3 - 10 файлов по 5, AI-подбор',
      '2x24 as-is - 2 файла по 24, без изменений',
      '5x10 mutation - 5 файлов с мутациями',
      '12x4 crossover - 12 файлов со скрещиванием',
      '1x100 complete - 1 файл со всеми элементами',
      '8x6 rule-based - 8 файлов по правилам',
      '4x16 self-evolve - 4 файла с самоэволюцией',
      '7x7 experimental - 7 файлов экспериментальный',
      '20x3 minimal - 20 файлов по 3 элемента'
    ],
    proTips: [
      'Формат: files×items strategy',
      'Меньше элементов = больше контроля',
      'Больше файлов = больше вариативность'
    ],
    relatedFields: ['compositionMode', 'maxBlocksPerElement'],
    pipelineStage: 4
  },
  {
    field: 'includeTags',
    label: 'Include tags',
    description: 'Теги для включения в выборку. Только элементы с этими тегами попадут в экспорт.',
    examples: [
      'kick, bass, snare - только ударные элементы',
      'ambient, pad, texture - фоновые текстуры',
      'industrial, dark, aggressive - темный стиль',
      'melodic, major, happy - мажорные мелодии',
      'sine, analog, vintage - аналоговый характер',
      'glitch, experimental, noise - экспериментальное',
      'reverb, delay, spatial - пространственные эффекты',
      'fast, energetic, high-bpm - энергичное',
      'slow, calm, meditation - медитативное',
      'synthetic, digital, modern - современное',
      'organic, acoustic, natural - естественное',
      'processed, effected, transformed - обработанное'
    ],
    proTips: [
      'Используйте ИЛИ-логику: любой из указанных тегов',
      'Комбинируйте с excludeTags для точной фильтрации',
      'Сохраняйте популярные комбинации как пресеты'
    ],
    relatedFields: ['excludeTags', 'includeKeys'],
    pipelineStage: 4
  },
  {
    field: 'excludeTags',
    label: 'Exclude tags',
    description: 'Теги для исключения из выборки. Элементы с этими тегами будут пропущены.',
    examples: [
      'experimental, draft, test - без черновиков',
      'low-quality, noisy, broken - только качественное',
      'deprecated, old, legacy - без устаревшего',
      'duplicate, clone, copy - без дубликатов',
      'incomplete, partial, wip - только завершенное',
      'error, invalid, failed - без ошибочных',
      'placeholder, template, sample - без шаблонов',
      'private, sensitive, internal - только публичное',
      'untested, unverified, new - только проверенное',
      'complex, heavy, large - без тяжелых',
      'foreign, external, imported - только локальное',
      'temporary, temp, cache - без временных'
    ],
    proTips: [
      'Используйте для очистки от мусора',
      'Создайте стандартный набор exclude для продакшена',
      'Проверяйте что не вырезали слишком много'
    ],
    relatedFields: ['includeTags'],
    pipelineStage: 4
  },
  {
    field: 'includeKeys',
    label: 'Include keys',
    description: 'JSON ключи, которые должны присутствовать в элементах выборки.',
    examples: [
      'frequency, amplitude, waveform - обязательные аудио-параметры',
      'bpm, tempo, timing - ритмические параметры',
      'midi, note, velocity - MIDI данные',
      'envelope, attack, release - огибающие',
      'filter, cutoff, resonance - фильтрация',
      'effects, reverb, delay - эффекты',
      'lfo, rate, depth - модуляция',
      'mixer, gain, pan - микширование',
      'metadata, author, date - метаданные',
      'tags, category, genre - категоризация',
      'version, revision, build - версионирование',
      'source, origin, reference - источники'
    ],
    proTips: [
      'Ключи проверяются на наличие, не на значение',
      'Используйте для валидации структуры',
      'Обязательные поля для вашего целевого формата'
    ],
    relatedFields: ['excludeKeys', 'includeTags'],
    pipelineStage: 4
  },
  {
    field: 'fileNamePattern',
    label: 'File name pattern',
    description: 'Шаблон имени файлов экспорта. Поддерживает переменные.',
    examples: [
      '{index}_{id}.json - порядковый номер и ID',
      '{preset}_{index}.json - имя пресета и номер',
      '{date}_{index}.json - дата и номер',
      '{id}_{timestamp}.json - ID и timestamp',
      'batch_{index:03d}.json - номер с ведущими нулями',
      '{preset}_v{version}_{index}.json - версионирование',
      '{domain}_{layer}_{index}.json - домен и слой',
      'export_{random}.json - случайный суффикс',
      '{intent:.10}_{index}.json - сокращенный intent',
      'block_{id:8}.json - сокращенный ID',
      '{category}_{subcategory}_{index}.json - иерархия',
      'final_{index}_{hash:6}.json - хеш для уникальности'
    ],
    proTips: [
      'Используйте {index} для сортировки по порядку',
      'Добавляйте {date} для временных меток',
      'Сокращайте длинные поля с помощью :N'
    ],
    relatedFields: ['presetLabel', 'compositionMode'],
    pipelineStage: 4
  },
  {
    field: 'maxBlocksPerElement',
    label: 'Max blocks per element',
    description: 'Максимальное количество блоков из одного исходного элемента.',
    examples: [
      '1 - один блок на элемент (дедупликация)',
      '2 - два варианта из каждого источника',
      '3 - три варианта для разнообразия',
      '4 - оптимум для сложных паттернов',
      '5 - пять вариантов с разными параметрами',
      '6 - для mutation-heavy генерации',
      '8 - множественные мутации и скрещивания',
      '10 - максимальное разнообразие',
      '12 - для F-Final режима',
      '16 - экспериментальная генерация',
      '20 - research mode',
      'unlimited - без ограничений (осторожно)'
    ],
    proTips: [
      '1 для чистых паттернов без дубликатов',
      '4-6 для баланса разнообразия и контроля',
      'Больше 10 только для экспериментов'
    ],
    relatedFields: ['compositionMode', 'pattern'],
    pipelineStage: 4
  }
];

// ============================================================================
// ПОДСКАЗКИ ДЛЯ MMSS RUNTIME PANEL
// ============================================================================

export const mmssRuntimeTooltips: FieldTooltip[] = [
  {
    field: 'intent',
    label: 'Intent',
    description: 'Семантический запрос для MMSS V3 Builder. Определяет характер генерируемых блоков.',
    examples: [
      'industrial hypnotic techno - техно с индустриальным оттенком',
      'ambient cinematic pads - кинематографические пэды',
      'aggressive dubstep bass - агрессивный дабстеп бас',
      'melodic progressive house - мелодичный прогрессив',
      'dark atmospheric techno - темное атмосферное техно',
      'glitch experimental noise - экспериментальный глитч',
      'warm analog synths - теплые аналоговые синты',
      'cold digital precision - холодная цифровая точность',
      'organic tribal rhythms - органические племенные ритмы',
      'futuristic sci-fi textures - футуристичные текстуры',
      'retro 80s nostalgia - ностальгия 80-х',
      'minimal microhouse - минимальный микрохаус'
    ],
    proTips: [
      'Используйте 2-4 дескриптивных слова',
      'Комбинируйте эмоцию + жанр + технику',
      'Конкретные термины дают лучшие результаты'
    ],
    relatedFields: ['domains', 'temperature'],
    pipelineStage: 3
  },
  {
    field: 'domains',
    label: 'Domains',
    description: 'Домены MMSS для включения в генерацию. Каждый домен отвечает за аспект композиции.',
    examples: [
      'Rhythm - ритмические паттерны и ударные',
      'Timbre - тембральные характеристики звуков',
      'Space - пространственные эффекты и локация',
      'Logic - логика композиции и структура',
      'Rhythm + Timbre - ритм и звучание',
      'Timbre + Space - текстура и пространство',
      'Space + Logic - атмосфера и форма',
      'Rhythm + Logic - ритм и структура',
      'All domains - полная композиция',
      'Rhythm only - только ударные',
      'Timbre only - только синтезаторы',
      'Logic only - только структурные элементы'
    ],
    proTips: [
      'Все 4 домена для полноценных композиций',
      'Rhythm + Timbre для ударных инструментов',
      'Исключите Logic для атмосферных звуков'
    ],
    relatedFields: ['intent', 'layers'],
    pipelineStage: 3
  },
  {
    field: 'temperature',
    label: 'Temperature',
    description: 'Температура семплирования. Контролирует случайность vs предсказуемость.',
    examples: [
      '0.1 - почти детерминированный, консервативный',
      '0.2 - небольшая вариативность',
      '0.3 - умеренная случайность',
      '0.4 - баланс порядка и хаоса',
      '0.5 - стандартная температура',
      '0.6 - творческий баланс',
      '0.7 - выраженная случайность',
      '0.8 - экспериментальный режим',
      '0.9 - близко к полной случайности',
      '1.0 - максимальная энтропия',
      '0.55 - оптимум для большинства задач',
      '0.35 - для боевых паттернов'
    ],
    proTips: [
      '0.3-0.5 для продакшен-качества',
      '0.6-0.8 для исследовательских задач',
      '0.1-0.2 для вариаций существующих паттернов'
    ],
    relatedFields: ['runs', 'intent'],
    pipelineStage: 3
  },
  {
    field: 'max_blocks',
    label: 'Max blocks',
    description: 'Максимальное количество блоков в одной композиции.',
    examples: [
      '3 - минимальная композиция',
      '5 - короткий паттерн',
      '8 - стандартный луп',
      '10 - оптимальный размер (по умолчанию)',
      '12 - расширенный паттерн',
      '16 - сложная композиция',
      '20 - эпический размер',
      '24 - полная сессия',
      '32 - максимальная сложность',
      '6 - небольшой сет',
      '15 - золотая середина',
      '50 - research batch'
    ],
    proTips: [
      '8-12 для стандартных музыкальных фраз',
      '16-24 для развернутых композиций',
      '3-5 для минималистичных паттернов'
    ],
    relatedFields: ['runs', 'domains'],
    pipelineStage: 3
  },
  {
    field: 'runs',
    label: 'Runs',
    description: 'Количество итераций builder для выбора лучшего результата.',
    examples: [
      '1 - быстрая генерация',
      '3 - минимальный отбор',
      '5 - базовый отбор',
      '8 - оптимум (по умолчанию)',
      '10 - тщательный отбор',
      '16 - глубокий поиск',
      '20 - максимальное качество',
      '32 - research mode',
      '50 - exhaustive search',
      '4 - быстрый тест',
      '12 - баланс скорости/качества',
      '64 - полный перебор'
    ],
    proTips: [
      '8-12 для баланса скорости и качества',
      '16+ для финальных релизов',
      '3-5 для быстрого прототипирования'
    ],
    relatedFields: ['temperature', 'max_blocks'],
    pipelineStage: 3
  },
  {
    field: 'layers',
    label: 'Layers',
    description: 'Уровни абстракции MMSS. Каждый уровень представляет разную гранулярность.',
    examples: [
      '1 - микро-уровень, параметры',
      '2 - мезо-уровень, паттерны',
      '3 - макро-уровень, структуры',
      '1,2 - параметры и паттерны',
      '2,3 - паттерны и структуры',
      '1,3 - параметры и структуры',
      '1,2,3 - все уровни (по умолчанию)',
      '2 only - только паттерны',
      '3 only - только высокоуровневое',
      '1 only - только детали',
      '2,3 with bias - уклон в структуру',
      'All layers balanced - сбалансировано'
    ],
    proTips: [
      'Все уровни для полноценной композиции',
      'Уровень 2 для паттерн-библиотек',
      'Уровень 3 для структурных шаблонов'
    ],
    relatedFields: ['domains', 'intent'],
    pipelineStage: 3
  }
];

// ============================================================================
// PIPELINE STRATEGY - ЦВЕТОВОЙ ПОШАГОВЫЙ ПОДСКАЗЧИК
// ============================================================================

export const pipelineSteps: PipelineStep[] = [
  // STAGE 1: IMPORT
  {
    stage: 1,
    title: 'Импорт данных',
    description: 'Получение JSON через WebSocket или файловую систему',
    actions: [
      'Проверьте статус WebSocket в Import Panel',
      'Запустите self-test для валидации канала',
      'Импортируйте первичный JSON из extension или файла',
      'Убедитесь что данные сохранились в IndexedDB'
    ],
    effectiveness: 'high',
    color: '#4ade80', // green
    icon: '📥'
  },
  {
    stage: 1,
    title: 'Валидация импорта',
    description: 'Проверка целостности и структуры импортированных данных',
    actions: [
      'Откройте Prompt List для просмотра элементов',
      'Проверьте Prompt Detail для валидации структуры',
      'Убедитесь что все ключи присутствуют',
      'Зафиксируйте количество импортированных элементов'
    ],
    effectiveness: 'medium',
    color: '#60a5fa', // blue
    icon: '✓'
  },
  
  // STAGE 2: SCAN & REGISTRY
  {
    stage: 2,
    title: 'Сканирование тегов',
    description: 'Извлечение ключей и значений из JSON структуры',
    actions: [
      'Нажмите "Find all (tags & keys)" в Tag & Key Explorer',
      'Дождитесь завершения сканирования',
      'Просмотрите найденные ключи во вкладке Keys',
      'Просмотрите значения во вкладке Values'
    ],
    effectiveness: 'high',
    color: '#4ade80',
    icon: '🔍'
  },
  {
    stage: 2,
    title: 'Создание реестра',
    description: 'Формирование глобального реестра семантических тегов',
    actions: [
      'Нажмите "Seed frequent tags" для автоматического создания',
      'Выберите важные ключи и значения чекбоксами',
      'Нажмите "Add selected to registry"',
      'Добавьте manual tags для семантических категорий'
    ],
    effectiveness: 'high',
    color: '#4ade80',
    icon: '🏷️'
  },
  {
    stage: 2,
    title: 'Применение тегов',
    description: 'Связывание тегов с элементами базы данных',
    actions: [
      'Нажмите "Apply & Update DB" для автоматической привязки',
      'Проверьте element-tag bindings',
      'Сохраните реестр через "Save registry"',
      'Экспортируйте метаданные при необходимости'
    ],
    effectiveness: 'medium',
    color: '#60a5fa',
    icon: '🔗'
  },
  {
    stage: 2,
    title: 'Извлечение последовательностей',
    description: 'Создание пресетов последовательностей ключей',
    actions: [
      'Перейдите в Sequence Presets panel',
      'Нажмите "Extract key sequences"',
      'Выберите частые последовательности',
      'Сохраните пресет с meaningful name'
    ],
    effectiveness: 'medium',
    color: '#60a5fa',
    icon: '📋'
  },
  
  // STAGE 3: PYTHON MMSS
  {
    stage: 3,
    title: 'Трансформация блоков',
    description: 'Нормализация producer.ai JSON в MMSS формат',
    actions: [
      'В MMSS Runtime Panel нажмите "Rebuild Blocks"',
      'Дождитесь трансформации всех элементов',
      'Проверьте database/blocks/ директорию',
      'Валидируйте структуру трансформированных блоков'
    ],
    effectiveness: 'high',
    color: '#4ade80',
    icon: '🔄'
  },
  {
    stage: 3,
    title: 'Индексация V3',
    description: 'Построение индекса для быстрого семантического поиска',
    actions: [
      'Нажмите "Rebuild Index" в MMSS Runtime',
      'Подождите завершения индексации',
      'Проверьте block_index_v3.json',
      'Убедитесь что все домены распознаны'
    ],
    effectiveness: 'high',
    color: '#4ade80',
    icon: '🗂️'
  },
  {
    stage: 3,
    title: 'Генерация эмбеддингов',
    description: 'Создание векторных представлений для семантического поиска',
    actions: [
      'Нажмите "Build Embeddings"',
      'Дождитесь векторизации всех блоков',
      'Проверьте embeddings.json',
      'Проверьте graph_v3.json для связей'
    ],
    effectiveness: 'medium',
    color: '#60a5fa',
    icon: '🔢'
  },
  {
    stage: 3,
    title: 'Генетические операции',
    description: 'Создание вариаций через мутацию и скрещивание',
    actions: [
      'Нажмите "Generate Mutations" для вариаций',
      'Нажмите "Generate Crossovers" для комбинаций',
      'Нажмите "Generate Self Rules" для эволюции правил',
      'Проверьте generated_blocks/ директорию'
    ],
    effectiveness: 'medium',
    color: '#fbbf24', // yellow
    icon: '🧬'
  },
  {
    stage: 3,
    title: 'Запуск Builder V3',
    description: 'Семантическая сборка блоков на основе intent',
    actions: [
      'Введите intent (например: "industrial hypnotic techno")',
      'Настройте temperature (0.3-0.6 для продакшена)',
      'Установите max_blocks (8-12 оптимум)',
      'Нажмите "Run MMSS V3 Builder" и дождитесь результата'
    ],
    effectiveness: 'high',
    color: '#4ade80',
    icon: '🏗️'
  },
  {
    stage: 3,
    title: 'Импорт результата',
    description: 'Добавление сгенерированных блоков в основную базу',
    actions: [
      'После успешной генерации нажмите "Import to Prompt Database"',
      'Проверьте что блоки появились в Prompt List',
      'Присвойте теги новым элементам',
      'Обновите индексы при необходимости'
    ],
    effectiveness: 'medium',
    color: '#60a5fa',
    icon: '📥'
  },
  
  // STAGE 4: EXPORT
  {
    stage: 4,
    title: 'Настройка фильтров',
    description: 'Определение критериев отбора для экспорта',
    actions: [
      'В Export Panel выберите includeTags для включения',
      'Укажите excludeTags для исключения мусора',
      'Добавьте includeKeys для валидации структуры',
      'Настройте excludeKeys при необходимости'
    ],
    effectiveness: 'high',
    color: '#4ade80',
    icon: '🔧'
  },
  {
    stage: 4,
    title: 'Выбор режима композиции',
    description: 'Определение алгоритма генерации финального JSON',
    actions: [
      'Для быстрого дампа: выберите "as-is"',
      'Для AI-подбора: выберите "mmss-v3"',
      'Для вариаций: выберите "mutation-engine"',
      'Для структурных паттернов: выберите "sequence-based"'
    ],
    effectiveness: 'high',
    color: '#4ade80',
    icon: '⚙️'
  },
  {
    stage: 4,
    title: 'Настройка паттерна',
    description: 'Определение количества файлов и элементов',
    actions: [
      'Укажите pattern: "files×items strategy"',
      'Настройте maxBlocksPerElement (1-4 оптимум)',
      'Выберите sequence presets для sequence-based режима',
      'Настройте fileNamePattern для организации выхода'
    ],
    effectiveness: 'medium',
    color: '#60a5fa',
    icon: '📐'
  },
  {
    stage: 4,
    title: 'Предпросмотр',
    description: 'Валидация генерируемых данных перед экспортом',
    actions: [
      'Нажмите "Update preview"',
      'Проверьте структуру в Preview payload',
      'Валидируйте JSON формат',
      'При необходимости скорректируйте фильтры'
    ],
    effectiveness: 'high',
    color: '#4ade80',
    icon: '👁️'
  },
  {
    stage: 4,
    title: 'Финальный экспорт',
    description: 'Сохранение сгенерированных файлов в файловую систему',
    actions: [
      'Нажмите "Export generated files"',
      'Выберите директорию для сохранения',
      'Проверьте созданные файлы',
      'Валидируйте итоговый результат'
    ],
    effectiveness: 'high',
    color: '#4ade80',
    icon: '📤'
  }
];

// ============================================================================
// STRATEGY VARIANTS - ВАРИАНТЫ СТРАТЕГИЙ ПАЙПЛАЙНА
// ============================================================================

export type PipelineVariant = 
  | 'quick-export'      // Быстрый экспорт
  | 'semantic-build'    // Семантическая сборка
  | 'evolutionary'      // Эволюционная генерация
  | 'research'          // Исследовательский режим
  | 'production';       // Продакшен режим

export interface StrategyVariant {
  id: PipelineVariant;
  name: string;
  description: string;
  steps: number[];  // Индексы шагов из pipelineSteps
  recommendedFor: string[];
  skipStages?: number[];
}

export const strategyVariants: StrategyVariant[] = [
  {
    id: 'quick-export',
    name: '⚡ Быстрый экспорт',
    description: 'Минимальная обработка для быстрого результата',
    steps: [0, 1, 13, 16, 17], // Import -> Validate -> Setup Filters -> Preview -> Export
    recommendedFor: [
      'Быстрый дамп существующих данных',
      'Проверка структуры импорта',
      'Тестирование канала импорта',
      'Создание резервной копии'
    ],
    skipStages: [3] // Skip Python MMSS
  },
  {
    id: 'semantic-build',
    name: '🎯 Семантическая сборка',
    description: 'Использование MMSS V3 для интеллектуального подбора',
    steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17],
    recommendedFor: [
      'Создание тематических коллекций',
      'Подбор по семантическому описанию',
      'Генерация вариаций паттернов',
      'Интеллектуальная фильтрация'
    ]
  },
  {
    id: 'evolutionary',
    name: '🧬 Эволюционная генерация',
    description: 'Полный цикл с мутациями и самоэволюцией правил',
    steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 9, 8, 13, 14, 15, 16, 17],
    recommendedFor: [
      'Исследование новых паттернов',
      'Создание уникальных комбинаций',
      'Разработка новых стилей',
      'Регенерация существующих библиотек'
    ]
  },
  {
    id: 'research',
    name: '🔬 Исследовательский',
    description: 'Максимальное исследование данных с детальным анализом',
    steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 9, 8, 9, 10, 13, 14, 15, 16, 17],
    recommendedFor: [
      'Анализ больших датасетов',
      'Исследование структурных паттернов',
      'Разработка новых алгоритмов',
      'Эксперименты с параметрами'
    ]
  },
  {
    id: 'production',
    name: '🏭 Продакшен',
    description: 'Оптимизированный пайплайн для финальных релизов',
    steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15, 16, 17],
    recommendedFor: [
      'Финальные релизы библиотек',
      'Коммерческие продукты',
      'Версионированные релизы',
      'Публикация для клиентов'
    ]
  }
];

// ============================================================================
// REACT COMPONENTS
// ============================================================================

interface TooltipDisplayProps {
  tooltip: FieldTooltip;
  isOpen: boolean;
  onClose: () => void;
}

export const TooltipDisplay: React.FC<TooltipDisplayProps> = ({ 
  tooltip, 
  isOpen, 
  onClose 
}) => {
  if (!isOpen) return null;

  return (
    <div className="tooltip-overlay" onClick={onClose}>
      <div className="tooltip-content" onClick={(e) => e.stopPropagation()}>
        <div className="tooltip-header">
          <h3>{tooltip.label}</h3>
          <span className={`stage-badge stage-${tooltip.pipelineStage}`}>
            Stage {tooltip.pipelineStage}
          </span>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <p className="tooltip-description">{tooltip.description}</p>
        
        <div className="tooltip-section">
          <h4>📋 Примеры использования ({tooltip.examples.length}):</h4>
          <ul className="examples-list">
            {tooltip.examples.slice(0, 10).map((example, idx) => (
              <li key={idx} className="example-item">
                <code>{example}</code>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="tooltip-section">
          <h4>💡 Pro Tips:</h4>
          <ul className="tips-list">
            {tooltip.proTips.map((tip, idx) => (
              <li key={idx} className="tip-item">{tip}</li>
            ))}
          </ul>
        </div>
        
        {tooltip.relatedFields && (
          <div className="tooltip-section">
            <h4>🔗 Связанные поля:</h4>
            <div className="related-fields">
              {tooltip.relatedFields.map((field) => (
                <span key={field} className="related-field">{field}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface PipelineGuideProps {
  currentStage: number;
  onStepClick?: (stepIndex: number) => void;
}

export const PipelineGuide: React.FC<PipelineGuideProps> = ({ 
  currentStage, 
  onStepClick 
}) => {
  const [selectedVariant, setSelectedVariant] = useState<PipelineVariant>('semantic-build');
  
  const variant = strategyVariants.find(v => v.id === selectedVariant);
  const currentSteps = pipelineSteps.filter(s => s.stage === currentStage);

  return (
    <div className="pipeline-guide">
      <div className="variant-selector">
        <label>Стратегия пайплайна:</label>
        <select 
          value={selectedVariant} 
          onChange={(e) => setSelectedVariant(e.target.value as PipelineVariant)}
        >
          {strategyVariants.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <p className="variant-description">{variant?.description}</p>
      </div>

      <div className="steps-container">
        {currentSteps.map((step, idx) => (
          <div 
            key={idx}
            className={`step-card effectiveness-${step.effectiveness}`}
            style={{ borderLeftColor: step.color }}
            onClick={() => onStepClick?.(idx)}
          >
            <div className="step-header">
              <span className="step-icon">{step.icon}</span>
              <h4>{step.title}</h4>
              <span 
                className="effectiveness-badge"
                style={{ backgroundColor: step.color }}
              >
                {step.effectiveness === 'high' ? '⭐ Высокая эффективность' : 
                 step.effectiveness === 'medium' ? '🔹 Средняя эффективность' : 
                 '🔸 Низкая эффективность'}
              </span>
            </div>
            <p className="step-description">{step.description}</p>
            <div className="step-actions">
              <h5>Действия:</h5>
              <ol>
                {step.actions.map((action, aidx) => (
                  <li key={aidx}>{action}</li>
                ))}
              </ol>
            </div>
          </div>
        ))}
      </div>

      {variant && (
        <div className="variant-recommendations">
          <h4>Рекомендуется для:</h4>
          <ul>
            {variant.recommendedFor.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HOOKS
// ============================================================================

export const useTooltip = () => {
  const [activeTooltip, setActiveTooltip] = useState<FieldTooltip | null>(null);

  const showTooltip = useCallback((tooltip: FieldTooltip) => {
    setActiveTooltip(tooltip);
  }, []);

  const hideTooltip = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  return {
    activeTooltip,
    showTooltip,
    hideTooltip,
    TooltipDisplay: () => (
      <TooltipDisplay 
        tooltip={activeTooltip!} 
        isOpen={!!activeTooltip} 
        onClose={hideTooltip} 
      />
    )
  };
};

// ============================================================================
// HELPER FUNCTION - Получение подсказки по полю
// ============================================================================

export const getTooltipForField = (
  field: string, 
  category: TooltipCategory
): FieldTooltip | null => {
  const allTooltips: Record<TooltipCategory, FieldTooltip[]> = {
    'tag-registry': tagRegistryTooltips,
    'sequence-presets': sequencePresetsTooltips,
    'export-composer': exportComposerTooltips,
    'mmss-runtime': mmssRuntimeTooltips,
    'import-panel': []
  };

  return allTooltips[category].find(t => t.field === field) || null;
};

// ============================================================================
// CSS STYLES (to be added to App.css)
// ============================================================================

export const tooltipStyles = `
/* Tooltip Overlay */
.tooltip-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.tooltip-content {
  background: #1a1a2e;
  border-radius: 12px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 24px;
  color: #e0e0e0;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #333;
}

.tooltip-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.3rem;
}

.stage-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.stage-1 { background: #4ade80; color: #000; }
.stage-2 { background: #60a5fa; color: #000; }
.stage-3 { background: #fbbf24; color: #000; }
.stage-4 { background: #f472b6; color: #000; }

.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
  cursor: pointer;
}

.close-btn:hover { color: #fff; }

.tooltip-description {
  color: #aaa;
  line-height: 1.6;
  margin-bottom: 20px;
}

.tooltip-section {
  margin-bottom: 20px;
}

.tooltip-section h4 {
  color: #fff;
  margin-bottom: 12px;
  font-size: 1rem;
}

.examples-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.example-item {
  padding: 8px 12px;
  margin-bottom: 6px;
  background: #252542;
  border-radius: 6px;
  border-left: 3px solid #4ade80;
}

.example-item code {
  color: #4ade80;
  font-family: 'Monaco', monospace;
  font-size: 0.85rem;
}

.tips-list {
  list-style: none;
  padding: 0;
}

.tip-item {
  padding: 8px 0;
  padding-left: 24px;
  position: relative;
  color: #fbbf24;
}

.tip-item::before {
  content: "💡";
  position: absolute;
  left: 0;
}

.related-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.related-field {
  padding: 4px 12px;
  background: #333;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #aaa;
}

/* Pipeline Guide */
.pipeline-guide {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
}

.variant-selector {
  margin-bottom: 20px;
}

.variant-selector label {
  display: block;
  color: #aaa;
  margin-bottom: 8px;
}

.variant-selector select {
  width: 100%;
  padding: 10px;
  background: #252542;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
}

.variant-description {
  color: #888;
  font-size: 0.9rem;
  margin-top: 8px;
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-card {
  background: #252542;
  border-radius: 8px;
  padding: 16px;
  border-left: 4px solid;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.step-card:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.effectiveness-high { border-left-color: #4ade80 !important; }
.effectiveness-medium { border-left-color: #60a5fa !important; }
.effectiveness-low { border-left-color: #fbbf24 !important; }

.step-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.step-icon {
  font-size: 1.5rem;
}

.step-header h4 {
  margin: 0;
  color: #fff;
  flex: 1;
}

.effectiveness-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #000;
}

.step-description {
  color: #aaa;
  margin-bottom: 12px;
  line-height: 1.5;
}

.step-actions {
  background: #1a1a2e;
  border-radius: 6px;
  padding: 12px;
}

.step-actions h5 {
  margin: 0 0 8px 0;
  color: #fff;
  font-size: 0.9rem;
}

.step-actions ol {
  margin: 0;
  padding-left: 20px;
  color: #888;
}

.step-actions li {
  margin-bottom: 4px;
  line-height: 1.4;
}

.variant-recommendations {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #333;
}

.variant-recommendations h4 {
  color: #fff;
  margin-bottom: 12px;
}

.variant-recommendations ul {
  color: #aaa;
  line-height: 1.8;
}

/* Field Label with Help Icon */
.field-with-tooltip {
  display: flex;
  align-items: center;
  gap: 8px;
}

.help-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #444;
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.help-icon:hover {
  background: #4ade80;
  color: #000;
}
`;

export default {
  tagRegistryTooltips,
  sequencePresetsTooltips,
  exportComposerTooltips,
  mmssRuntimeTooltips,
  pipelineSteps,
  strategyVariants,
  getTooltipForField,
  tooltipStyles
};
