# 📋 ПОЛНОЕ ТЕХНИЧЕСКОЕ ЗАДАНИЕ
## Producer.ai Archive Manager — React Application
### Репозиторий: `https://github.com/Abstract-Mindfreak/extract`  
### Рабочая директория: `react/my-app`  
### Приоритет: Сначала Data Layer (сбор/парсинг), затем UI

---

## 🎯 ОБЩАЯ ЦЕЛЬ ПРОЕКТА

Создать полнофункциональное React-приложение для управления архивом сгенерированных аудиотреков Producer.ai с четырёх аккаунтов пользователя. Приложение должно обеспечивать:

1. **Импорт и парсинг** локально сохранённых данных (`meta.json`, `audio.m4a`, `image.jpg`) из структуры `producer-ai-archiver/`
2. **Извлечение и агрегацию** данных сессий (диалогов) по полю `conversation_id`
3. **Привязку** текстовых фрагментов диалогов к конкретным аудиотрекам
4. **Удобный интерфейс** для просмотра, фильтрации, оценки и редактирования метаданных
5. **Экспорт** структурированных данных в единые файлы для дальнейшего использования

> ⚠️ **Важно**: Проект `prompt-db-local` отложен. Вся работа ведётся в контексте `react/my-app`. Данные хранятся локально в браузере (IndexedDB) или загружаются через файловый API (при использовании Electron).

---

## 🗂️ СТРУКТУРА ИСХОДНЫХ ДАННЫХ

### 1. Архив треков (источник)
```
producer-ai-archiver/
├── producer_backup_1/
├── producer_backup_2/
├── producer_backup_3/
├── producer_backup_4/
│   └── fe/
│       └── fed15fa7-0a64-47a0-ad4e-4d12106107f2_Φ_TOTAL_ANTI_PATTERN_v1/
│           ├── meta.json      # Полные метаданные генерации
│           ├── audio.m4a      # Аудиофайл (также доступен .wav)
│           └── image.jpg      # Обложка трека
```

### 2. Ключевые поля `meta.json` (источник истины)
```json
{
  "id": "fed15fa7-0a64-47a0-ad4e-4d12106107f2",
  "title": "Φ_TOTAL_ANTI_PATTERN_v1",
  "audio_url": "https://storage.googleapis.com/.../fed15fa7....m4a",
  "image_url": "https://storage.googleapis.com/.../639ba025-....jpg",
  "created_at": "2026-04-12T11:53:12.314211Z",
  "source_url": "https://www.producer.ai/song/fed15fa7-...",
  "lyrics": {
    "status": "completed",
    "value": { "id": "...", "text": "[Instrumental]" }
  },
  "raw_data": {
    "id": "fed15fa7-0a64-47a0-ad4e-4d12106107f2",
    "author_id": "7f0a0aad-f088-470b-8855-84c9537c80af",
    "op_id": "639ba025-121a-5364-a9ed-167a9e7022bc",
    "op_type": "audio__create_song",
    "duration": { "status": "completed", "value": "146.144" },
    "operation": {
      "op_type": "audio__create_song",
      "conversation_id": "f1ff1a79-8a17-4b66-8d54-cede0ed96bc6",
      "sound_prompt": "anti-grid stochastic rhythm, aperiodic broken clock timing...",
      "title": "Φ_TOTAL_ANTI_PATTERN_v1",
      "seed": null,
      "lyrics_id": ""
    },
    "audio_url": "...",
    "wav_url": "...",
    "image_url": "..."
  }
}
```

### 3. Целевая структура хранения в приложении
```
react/my-app/public/local-data/
├── tracks/                          # Нормализованные данные треков
│   ├── track_fed15fa7....json
│   └── ...
├── sessions/                        # Агрегированные сессии по conversation_id
│   ├── session_f1ff1a79....json
│   └── ...
├── links/                           # Привязки фрагментов текста к трекам
│   └── fragment_links.json
├── settings.json                    # Пользовательские настройки отображения
└── ratings.json                     # Пользовательские оценки треков (0-10)
```

---

## 🧱 ПОЛНЫЕ ТИПЫ ДАННЫХ (TypeScript)

### Файл: `src/types/index.ts`

```typescript
// ============================================
// ОСНОВНЫЕ СУЩНОСТИ
// ============================================

/**
 * Нормализованное представление трека для использования в приложении
 */
export interface Track {
  /** Уникальный идентификатор трека (UUID) */
  id: string;
  
  /** Человекочитаемое название трека */
  title: string;
  
  /** Идентификатор аккаунта-источника (1, 2, 3 или 4) */
  accountId: 1 | 2 | 3 | 4;
  
  /** Локальный путь или Blob URL к изображению обложки */
  coverUrl: string;
  
  /** Локальный путь или Blob URL к аудиофайлу (.m4a) */
  audioUrl: string;
  
  /** URL к WAV-версии (если доступна) */
  wavUrl?: string;
  
  /** Длительность трека в секундах (из raw_data.duration.value) */
  durationSeconds?: number;
  
  /** Дата и время создания трека (ISO 8601) */
  createdAt: string;
  
  /** Текстовый промпт, использованный для генерации (sound_prompt) */
  soundPrompt: string;
  
  /** Текст лирики (если есть, иначе "[Instrumental]") */
  lyrics?: string;
  
  /** Идентификатор сессии для привязки к диалогу (conversation_id) */
  conversationId?: string;
  
  /** Прямая ссылка на трек на сайте producer.ai */
  sourceUrl: string;
  
  /** Пользовательская оценка трека от 0 до 10 (сохраняется локально) */
  rating?: number;
  
  /** Количество воспроизведений (из метаданных) */
  playCount?: number;
  
  /** Полное исходное содержимое meta.json для отладки и расширенного доступа */
  raw: RawMetaJson;
}

/**
 * Полная структура исходного meta.json (для типизации raw-данных)
 */
export interface RawMetaJson {
  id: string;
  title: string;
  audio_url: string;
  video_url: string | null;
  image_url: string;
  created_at: string;
  source_url: string;
  sound: any | null;
  lyrics: {
    status: string;
    value: {
      id: string;
      text: string;
    } | null;
  };
  duration: any | null;
  model_version: string | null;
  seed: any | null;
  play_count: number;
  favorite_count: number;
  parent_id: string | null;
  transform_type: string | null;
  conditions: any | null;
  lyrics_timestamped: any | null;
  raw_data: {
    id: string;
    author_id: string;
    op_id: string;
    op_type: string;
    duration: {
      status: string;
      value: string;
    } | null;
    lyrics: {
      status: string;
      value: {
        id: string;
        text: string;
      } | null;
    };
    lyrics_timing: {
      status: string;
    };
    user_edited_lyrics_id: string | null;
    title: string;
    privacy: string;
    allow_public_use: boolean;
    image_id: string;
    video_id: string | null;
    created_at: string;
    deleted_at: string | null;
    operation: {
      op_type: string;
      conversation_id: string;
      sound_prompt: string;
      title: string;
      seed: any | null;
      lyrics_id: string;
    };
    is_favorite: boolean;
    preference_state: any | null;
    favorite_count: number;
    play_count: number;
    audio_url: string;
    wav_url: string;
    image_url: string;
    video_url: string | null;
  };
}

/**
 * Агрегированное представление сессии (диалога) по conversation_id
 */
export interface ParsedSession {
  /** UUID сессии (conversation_id) */
  conversationId: string;
  
  /** Идентификатор аккаунта, в котором найдена сессия (основной источник) */
  primaryAccountId: 1 | 2 | 3 | 4;
  
  /** Список аккаунтов, в которых встречалась эта сессия (для дедупликации) */
  sourceAccounts: Array<1 | 2 | 3 | 4>;
  
  /** Дата первого сообщения в сессии (ISO 8601) */
  createdAt: string;
  
  /** Дата последнего сообщения в сессии (ISO 8601) */
  updatedAt: string;
  
  /** Массив сообщений диалога в хронологическом порядке */
  messages: SessionMessage[];
  
  /** Список треков, привязанных к этой сессии */
  linkedTracks: LinkedTrackRef[];
  
  /** Статистика и метаданные сессии */
  meta: {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    systemMessages: number;
    hasAudioGenerations: boolean;
    promptFragments: string[];
    estimatedDurationMinutes?: number;
  };
}

/**
 * Отдельное сообщение в диалоге сессии
 */
export interface SessionMessage {
  /** Уникальный идентификатор сообщения (UUID или хэш контента) */
  id: string;
  
  /** Роль отправителя сообщения */
  role: 'user' | 'assistant' | 'system';
  
  /** Текстовое содержимое сообщения (поддерживает Markdown-разметку) */
  content: string;
  
  /** Время отправки сообщения (ISO 8601, если доступно) */
  timestamp?: string;
  
  /** Если это сообщение породило аудиотрек — ссылка на него */
  linkedTrackId?: string;
  
  /** Метаданные аудио, если сообщение содержит генерацию */
  audioMetadata?: {
    trackId: string;
    title: string;
    durationSeconds?: number;
    prompt: string;
    coverUrl: string;
    audioUrl: string;
  };
  
  /** Фрагменты текста для ручной выборки и привязки */
  textFragments?: TextFragment[];
  
  /** Дополнительные данные для отладки */
  debug?: {
    sourceMetaPath?: string;
    extractedAt?: string;
  };
}

/**
 * Фрагмент текста внутри сообщения для выборочной привязки к треку
 */
export interface TextFragment {
  /** Уникальный идентификатор фрагмента */
  fragmentId: string;
  
  /** Текстовое содержимое фрагмента */
  text: string;
  
  /** Позиция начала фрагмента в исходном content (индекс символа) */
  startIndex: number;
  
  /** Позиция конца фрагмента в исходном content (индекс символа) */
  endIndex: number;
  
  /** Помечен ли фрагмент как выбранный для экспорта/привязки */
  isSelected: boolean;
  
  /** Если привязан к треку — его идентификатор */
  linkedTrackId?: string;
  
  /** Дата создания привязки фрагмента */
  createdAt: string;
  
  /** Дата последнего изменения статуса фрагмента */
  updatedAt?: string;
}

/**
 * Ссылка на трек, привязанный к сессии
 */
export interface LinkedTrackRef {
  /** Идентификатор трека */
  trackId: string;
  
  /** Название трека */
  title: string;
  
  /** Локальный путь к аудиофайлу */
  audioPath: string;
  
  /** Локальный путь к изображению обложки */
  coverPath: string;
  
  /** Локальный путь к meta.json */
  metaPath: string;
  
  /** Промпт генерации (sound_prompt) */
  prompt: string;
  
  /** Дата создания трека */
  createdAt: string;
  
  /** Пользовательская оценка (0-10) */
  rating?: number;
  
  /** Дополнительные метаданные для быстрого доступа */
  quickMeta: {
    durationSeconds?: number;
    playCount?: number;
    lyrics?: string;
  };
}

// ============================================
// НАСТРОЙКИ И ФИЛЬТРЫ
// ============================================

/**
 * Пользовательские настройки отображения интерфейса
 */
export interface DisplaySettings {
  /** Какие колонки показывать в таблице треков */
  visibleColumns: {
    cover: boolean;
    title: boolean;
    accountBadge: boolean;
    duration: boolean;
    createdAt: boolean;
    soundPrompt: boolean;
    lyrics: boolean;
    rating: boolean;
    links: boolean;
    sessionDialog: boolean;
  };
  
  /** Тема оформления: 'light' | 'dark' | 'system' */
  theme: 'light' | 'dark' | 'system';
  
  /** Количество треков на странице пагинатора */
  itemsPerPage: 25 | 50 | 100;
  
  /** Сортировка по умолчанию */
  defaultSort: {
    field: keyof Track;
    direction: 'asc' | 'desc';
  };
  
  /** Автоматическое воспроизведение при наведении (предпросмотр) */
  hoverPreview: boolean;
  
  /** Длина предпросмотра в секундах */
  previewDuration: 5 | 10 | 15;
}

/**
 * Фильтры для поиска и отображения треков
 */
export interface TrackFilters {
  /** Фильтр по аккаунту-источнику */
  accountId?: 1 | 2 | 3 | 4;
  
  /** Фильтр по диапазону дат создания */
  dateRange?: {
    from: string; // ISO date
    to: string;   // ISO date
  };
  
  /** Фильтр по рейтингу (минимальное значение) */
  minRating?: number;
  
  /** Фильтр по наличию sound_prompt */
  hasPrompt?: boolean;
  
  /** Фильтр по наличию лирики (не "[Instrumental]") */
  hasLyrics?: boolean;
  
  /** Фильтр по наличию привязанной сессии */
  hasSession?: boolean;
  
  /** Полнотекстовый поиск по названию, промпту или лирике */
  searchQuery?: string;
  
  /** Фильтр по конкретному conversation_id */
  conversationId?: string;
}

/**
 * Состояние пагинатора
 */
export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

// ============================================
// ВНУТРЕННИЕ СЛУЖЕБНЫЕ ТИПЫ
// ============================================

/**
 * Результат сканирования файловой системы
 */
export interface ScanResult {
  /** Общее количество найденных meta.json файлов */
  totalFilesFound: number;
  
  /** Количество успешно распарсенных файлов */
  successfullyParsed: number;
  
  /** Количество файлов с ошибками парсинга */
  parseErrors: Array<{
    filePath: string;
    error: string;
  }>;
  
  /** Список извлечённых треков */
  tracks: Track[];
  
  /** Список найденных уникальных conversation_id */
  uniqueConversationIds: string[];
  
  /** Время выполнения сканирования (мс) */
  executionTimeMs: number;
}

/**
 * Сообщение для логирования в интерфейсе
 */
export interface LogMessage {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: any;
}
```

---

## 📁 СТРУКТУРА ПРОЕКТА `react/my-app`

```
react/my-app/
├── public/
│   ├── local-data/                    # Локальное хранилище данных (создаётся при импорте)
│   │   ├── tracks/
│   │   ├── sessions/
│   │   ├── links/
│   │   ├── settings.json
│   │   └── ratings.json
│   └── mock-data/                     # Моковые данные для разработки
│       ├── tracks.json
│       └── sessions.json
│
├── src/
│   ├── types/
│   │   └── index.ts                   # Все TypeScript интерфейсы (см. выше)
│   │
│   ├── services/
│   │   ├── FileSystemService.ts       # Работа с файловым API / Electron fs
│   │   ├── MetaParser.ts              # Парсинг meta.json → Track
│   │   ├── SessionExtractor.ts        # Извлечение сессий из треков
│   │   ├── FragmentMapper.ts          # Привязка фрагментов текста к трекам
│   │   ├── StorageService.ts          # Работа с IndexedDB / localStorage
│   │   └── ExportService.ts           # Экспорт данных в JSON/CSV/MD
│   │
│   ├── hooks/
│   │   ├── useTracks.ts               # Хук для загрузки и фильтрации треков
│   │   ├── useSessions.ts             # Хук для работы с сессиями
│   │   ├── usePagination.ts           # Хук пагинации
│   │   ├── useAudioPlayer.ts          # Хук управления воспроизведением
│   │   └── useDisplaySettings.ts      # Хук настроек отображения
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx          # Основная разметка приложения
│   │   │   ├── Header.tsx             # Шапка с поиском и настройками
│   │   │   └── Sidebar.tsx            # Боковая панель с фильтрами
│   │   │
│   │   ├── tracks/
│   │   │   ├── TrackTable.tsx         # Табличный список треков
│   │   │   ├── TrackRow.tsx           # Отдельная строка трека
│   │   │   ├── CoverCell.tsx          # Ячейка с обложкой и кнопкой play
│   │   │   ├── PromptCell.tsx         # Ячейка с sound_prompt (сворачиваемая)
│   │   │   ├── RatingCell.tsx         # Ячейка с оценкой 0-10
│   │   │   └── ActionsCell.tsx        # Кнопки действий (диалог, ссылки)
│   │   │
│   │   ├── sessions/
│   │   │   ├── SessionDialog.tsx      # Модальное окно сессии
│   │   │   ├── MessageList.tsx        # Список сообщений диалога
│   │   │   ├── MessageBubble.tsx      # Отдельное сообщение (user/assistant)
│   │   │   ├── FragmentSelector.tsx   # UI для выборки фрагментов текста
│   │   │   └── LinkManager.tsx        # Управление привязками фрагмент→трек
│   │   │
│   │   ├── controls/
│   │   │   ├── Pagination.tsx         # Компонент пагинации
│   │   │   ├── FilterPanel.tsx        # Панель фильтров
│   │   │   ├── ColumnToggler.tsx      # Чекбоксы видимости колонок
│   │   │   ├── ThemeToggle.tsx        # Переключатель темы
│   │   │   └── SearchInput.tsx        # Поле полнотекстового поиска
│   │   │
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── Tooltip.tsx
│   │       ├── Badge.tsx
│   │       └── MarkdownRenderer.tsx   # Рендеринг markdown в сообщениях
│   │
│   ├── utils/
│   │   ├── date.ts                    # Форматирование дат
│   │   ├── duration.ts                # Конвертация секунд в мм:сс
│   │   ├── text.ts                    # Обрезка текста, экранирование
│   │   ├── uuid.ts                    # Генерация UUID для фрагментов
│   │   └── validation.ts              # Валидация данных по схемам
│   │
│   ├── constants/
│   │   ├── columns.ts                 # Конфигурация колонок таблицы
│   │   ├── filters.ts                 # Пресеты фильтров
│   │   └── routes.ts                  # Маршруты приложения (если нужен роутинг)
│   │
│   ├── contexts/
│   │   ├── AppContext.tsx             # Глобальный контекст приложения
│   │   └── PlayerContext.tsx          # Контекст аудиоплеера
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx              # Главная страница со списком треков
│   │   ├── ImportWizard.tsx           # Мастер импорта данных из архива
│   │   └── Settings.tsx               # Страница настроек приложения
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## ⚙️ ЭТАП 0: ПОДГОТОВКА И АНАЛИЗ

### 0.1 Инициализация проекта
- [ ] Убедиться, что `react/my-app` использует:
  - React 18 + TypeScript
  - Vite в качестве сборщика
  - ESLint + Prettier для линтинга
- [ ] Установить базовые зависимости:
```bash
npm install zustand react-window @tanstack/react-table react-markdown remark-gfm howler date-fns uuid
npm install -D @types/howler @types/uuid
```

### 0.2 Настройка моковых данных
- [ ] Создать `public/mock-data/tracks.json` с 10-15 примерами треков на основе реальных `meta.json`
- [ ] Создать `public/mock-data/sessions.json` с 3-5 примерами сессий с разными сценариями:
  - Сессия с одним треком
  - Сессия с несколькими треками
  - Сессия без треков (только диалог)
  - Сессия с фрагментами для выборки
- [ ] Реализовать `src/services/MockDataService.ts` с методами:
```ts
getMockTracks(): Promise<Track[]>;
getMockSessions(): Promise<ParsedSession[]>;
getMockTrackById(id: string): Promise<Track | null>;
```

### 0.3 Настройка хранилища
- [ ] Реализовать `src/services/StorageService.ts` с адаптерами:
  - `IndexedDBAdapter` — для хранения в браузере (основной)
  - `LocalStorageAdapter` — для настроек и кэша
  - `MockAdapter` — для разработки без реального хранения
- [ ] Определить схемы хранилищ:
  - `tracks` → объект по `track.id`
  - `sessions` → объект по `session.conversationId`
  - `settings` → объект `DisplaySettings`
  - `ratings` → объект `{ [trackId: string]: number }`

---

## 🔧 ЭТАП 1: DATA LAYER — СБОР И ПАРСИНГ 

### 1.1 Модуль: `FileSystemService` (работа с файлами)
**Файл**: `src/services/FileSystemService.ts`

```ts
export interface IFileSystemService {
  /**
   * Рекурсивно сканирует директорию на наличие meta.json файлов
   * @param basePath - корневая папка архива (producer-ai-archiver)
   * @param accountIds - список аккаунтов для обработки [1,2,3,4]
   */
  scanArchive(
    basePath: string, 
    accountIds: Array<1|2|3|4>
  ): Promise<ScanResult>;
  
  /**
   * Читает содержимое файла по пути
   */
  readFile(path: string): Promise<string>;
  
  /**
   * Записывает данные в файл (для экспорта)
   */
  writeFile(path: string, content: string): Promise<void>;
  
  /**
   * Конвертирует локальный путь в Blob URL для использования в <img> и <audio>
   */
  pathToBlobUrl(filePath: string, mimeType: string): Promise<string>;
}
```

**Реализация:**
- [ ] Для web-версии: использовать File System Access API (`window.showDirectoryPicker`) с фоллбэком на загрузку через `<input type="file" webkitdirectory>`
- [ ] Для Electron-версии (опционально позже): использовать `fs.promises`
- [ ] Обработка ошибок: недоступные файлы, неверная структура папок, повреждённые JSON

### 1.2 Модуль: `MetaParser` (парсинг meta.json)
**Файл**: `src/services/MetaParser.ts`

```ts
export interface IMetaParser {
  /**
   * Парсит сырой JSON meta.json в нормализованный объект Track
   */
  parseMetaJson(rawJson: string, accountId: 1|2|3|4, metaFilePath: string): Track;
  
  /**
   * Валидирует структуру meta.json по ожидаемой схеме
   * @throws {Error} если обязательные поля отсутствуют
   */
  validateMetaJson(raw: any): void;
  
  /**
   * Извлекает duration в секундах из raw_data.duration.value (строка "146.144" → number)
   */
  extractDuration(raw: RawMetaJson): number | undefined;
  
  /**
   * Извлекает sound_prompt из вложенной структуры operation
   */
  extractSoundPrompt(raw: RawMetaJson): string;
}
```

**Логика парсинга:**
- [ ] Обязательные поля: `id`, `title`, `created_at`, `raw_data.operation.sound_prompt`
- [ ] Опциональные поля с дефолтами: `duration` → `undefined`, `lyrics` → `"[Instrumental]"`
- [ ] Конвертация путей: из абсолютных путей архива в относительные для `public/local-data/`
- [ ] Обработка `null`/`undefined` значений без падений

### 1.3 Модуль: `SessionExtractor` (извлечение сессий)
**Файл**: `src/services/SessionExtractor.ts`

```ts
export interface ISessionExtractor {
  /**
   * Группирует массив треков по conversation_id и строит объекты ParsedSession
   */
  extractSessions(tracks: Track[]): ParsedSession[];
  
  /**
   * Эвристика восстановления сообщений диалога из метаданных трека:
   * - Сообщение пользователя: содержит sound_prompt
   * - Сообщение ассистента: содержит audio_url + timestamp
   */
  reconstructMessagesFromTrack(track: Track): SessionMessage[];
  
  /**
   * Объединяет сессии с одинаковым conversation_id из разных аккаунтов
   */
  mergeDuplicateSessions(sessions: ParsedSession[]): ParsedSession[];
  
  /**
   * Автоматически создаёт привязки: если сообщение содержит audio_url → linkedTrackId
   */
  autoLinkTracksToMessages(session: ParsedSession): ParsedSession;
}
```

**Алгоритм извлечения:**
1. Группировка треков: `Map<conversation_id, Track[]>`
2. Для каждой группы:
   - Сортировка треков по `created_at`
   - Для каждого трека:
     - Создать сообщение пользователя с `sound_prompt` (если есть)
     - Создать сообщение ассистента с `audio_url` и метаданными
     - Если `lyrics.text !== "[Instrumental]"` → добавить в контент ассистента
   - Объединить последовательные сообщения одной роли
3. Дедупликация: если `conversation_id` встречается в нескольких аккаунтах:
   - Взять `primaryAccountId` из самого раннего трека
   - Объединить массивы `messages`, удалив дубликаты по хэшу контента
   - Объединить `linkedTracks`, избегая повторов по `trackId`

### 1.4 Модуль: `FragmentMapper` (привязка фрагментов)
**Файл**: `src/services/FragmentMapper.ts`

```ts
export interface IFragmentMapper {
  /**
   * Создаёт новый фрагмент текста внутри сообщения
   */
  createFragment(
    messageId: string,
    content: string,
    startIndex: number,
    endIndex: number,
    linkedTrackId?: string
  ): TextFragment;
  
  /**
   * Находит все фрагменты, привязанные к указанному треку
   */
  getFragmentsByTrack(trackId: string, sessions: ParsedSession[]): TextFragment[];
  
  /**
   * Обновляет статус isSelected у фрагмента
   */
  toggleFragmentSelection(fragmentId: string, sessions: ParsedSession[]): void;
  
  /**
   * Экспортирует выбранные фрагменты в структурированный объект
   */
  exportSelectedFragments(sessions: ParsedSession[]): Record<string, TextFragment[]>;
}
```

**Функционал:**
- [ ] Генерация `fragmentId` через `crypto.randomUUID()` или `uuid.v4()`
- [ ] Валидация `startIndex`/`endIndex`: не выходят за границы `content`, `start < end`
- [ ] Хранение маппинга: `Map<fragmentId, { messageId, trackId?, isSelected }>`
- [ ] Экспорт в формат, пригодный для сохранения в `links/fragment_links.json`

### 1.5 Модуль: `ImportOrchestrator` (координация импорта)
**Файл**: `src/services/ImportOrchestrator.ts`

```ts
export interface IImportOrchestrator {
  /**
   * Полный пайплайн импорта: сканирование → парсинг → извлечение сессий → сохранение
   */
  runFullImport(
    archivePath: string,
    accountIds: Array<1|2|3|4>,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult>;
}

export interface ImportProgress {
  stage: 'scanning' | 'parsing' | 'extracting' | 'saving';
  completed: number;
  total: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  stats: {
    filesScanned: number;
    tracksImported: number;
    sessionsCreated: number;
    fragmentsLinked: number;
    errors: number;
  };
  errors: Array<{ file: string; error: string }>;
  executionTimeMs: number;
}
```

**Пайплайн:**
```
1. FileSystemService.scanArchive() 
   → получаем список путей к meta.json
   
2. Для каждого файла:
   - MetaParser.parseMetaJson() → Track
   - Сохраняем Track в StorageService (IndexedDB)
   
3. SessionExtractor.extractSessions(allTracks) 
   → получаем массив ParsedSession
   
4. Для каждой сессии:
   - FragmentMapper.autoLinkTracksToMessages()
   - Сохраняем сессию в StorageService
   
5. Генерируем отчёт ImportResult
```

### 1.6 CLI-утилита для импорта (опционально, но желательно)
**Файл**: `scripts/import-cli.ts` (запускается через `npm run import`)

```bash
# Синтаксис запуска
npm run import -- \
  --input "./producer-ai-archiver" \
  --accounts "1,2,3,4" \
  --output "./public/local-data" \
  --dry-run \
  --verbose

# Пример вывода:
[✓] Scanning archive... found 1,247 meta.json files
[✓] Parsing tracks... 1,247/1,247 (0 errors)
[✓] Extracting sessions... found 312 unique conversation_id
[✓] Linking fragments... auto-linked 1,189 tracks
[✓] Saving to IndexedDB... done
[✓] Exporting summary to local-data/import-report.json

📊 Import Summary:
   Tracks: 1,247 imported, 0 failed
   Sessions: 312 created, 58 tracks without session
   Fragments: 0 manual, 1,189 auto-linked
   Time: 12.4s
```

**Реализация:**
- [ ] Использовать `commander` или `yargs` для парсинга аргументов
- [ ] Вывод прогресса через `console.log` с цветовым форматированием (chalk)
- [ ] Флаг `--dry-run`: выполнять все шаги кроме записи в хранилище
- [ ] Флаг `--verbose`: выводить детали по каждому файлу
- [ ] Экспорт отчёта в `local-data/import-report.json`

---

## 🎨 ЭТАП 2: UI — ТАБЛИЦА ТРЕКОВ И БАЗОВЫЙ ИНТЕРФЕЙС 

### 2.1 Компонент: `TrackTable` (основная таблица)
**Файл**: `src/components/tracks/TrackTable.tsx`

**Требования:**
- [ ] Использовать `@tanstack/react-table` для гибкой конфигурации колонок
- [ ] Использовать `react-window` для виртуализации при >100 элементов (производительность)
- [ ] Поддержка сортировки по клику на заголовок колонки
- [ ] Поддержка множественной сортировки (Shift+клик)
- [ ] Адаптивная ширина колонок с возможностью ресайза (опционально)

**Конфигурация колонок (файл `src/constants/columns.ts`):**
```ts
export const DEFAULT_COLUMNS: ColumnDef<Track>[] = [
  {
    id: 'cover',
    header: '',
    cell: ({ row }) => <CoverCell track={row.original} />,
    enableSorting: false,
    size: 80,
  },
  {
    id: 'title',
    header: 'Название',
    accessorKey: 'title',
    cell: ({ row }) => (
      <div>
        <div>{row.original.title}</div>
        {displaySettings.accountBadge && (
          <Badge variant="account-{row.original.accountId}">
            Аккаунт {row.original.accountId}
          </Badge>
        )}
      </div>
    ),
    minSize: 200,
  },
  {
    id: 'duration',
    header: 'Длительность',
    cell: ({ row }) => formatDuration(row.original.durationSeconds),
    enableSorting: true,
    size: 100,
  },
  {
    id: 'createdAt',
    header: 'Дата',
    cell: ({ row }) => formatDate(row.original.createdAt),
    enableSorting: true,
    size: 150,
  },
  {
    id: 'soundPrompt',
    header: 'Промпт',
    cell: ({ row }) => <PromptCell prompt={row.original.soundPrompt} />,
    enableSorting: false,
    size: 300,
  },
  {
    id: 'lyrics',
    header: 'Лирика',
    cell: ({ row }) => row.original.lyrics || '[Instrumental]',
    enableSorting: false,
    size: 200,
  },
  {
    id: 'rating',
    header: 'Оценка',
    cell: ({ row }) => (
      <RatingCell 
        value={row.original.rating} 
        onChange={(val) => handleRatingChange(row.original.id, val)} 
      />
    ),
    enableSorting: true,
    size: 100,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <ActionsCell track={row.original} />,
    enableSorting: false,
    size: 120,
  },
];
```

### 2.2 Компонент: `CoverCell` (обложка + предпросмотр)
**Файл**: `src/components/tracks/CoverCell.tsx`

```tsx
export const CoverCell: React.FC<{ track: Track }> = ({ track }) => {
  const { playPreview, stopPreview, isPlaying } = useAudioPlayer();
  const [isHovered, setIsHovered] = useState(false);
  
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (displaySettings.hoverPreview) {
      playPreview(track.audioUrl, displaySettings.previewDuration);
    }
  };
  
  const handleMouseLeave = () => {
    setIsHovered(false);
    stopPreview();
  };
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Открыть полный плеер или перейти к треку
  };
  
  return (
    <div 
      className="cover-cell"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <img src={track.coverUrl} alt={track.title} className="cover-image" />
      {isHovered && (
        <div className="play-overlay">
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </div>
      )}
    </div>
  );
};
```

**Стили (CSS-модуль или Tailwind):**
- Плавное появление оверлея при наведении (`transition-opacity`)
- Иконка play/pause по центру обложки
- Подсветка границы при наведении
- Адаптивный размер: 64x64px на десктопе, 48x48px на мобильных

### 2.3 Компонент: `PromptCell` (сворачиваемый промпт)
**Файл**: `src/components/tracks/PromptCell.tsx`

```tsx
export const PromptCell: React.FC<{ prompt: string }> = ({ prompt }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { copyToClipboard } = useClipboard();
  
  const MAX_PREVIEW_LENGTH = 100;
  const preview = prompt.length > MAX_PREVIEW_LENGTH 
    ? prompt.slice(0, MAX_PREVIEW_LENGTH) + '...' 
    : prompt;
  
  return (
    <div className="prompt-cell">
      <p className={isExpanded ? 'expanded' : 'collapsed'}>
        {isExpanded ? prompt : preview}
      </p>
      <div className="prompt-actions">
        <button onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Свернуть' : 'Развернуть'}
        </button>
        <button onClick={() => copyToClipboard(prompt)}>
          Копировать
        </button>
      </div>
    </div>
  );
};
```

### 2.4 Компонент: `RatingCell` (оценка 0-10)
**Файл**: `src/components/tracks/RatingCell.tsx`

```tsx
export const RatingCell: React.FC<{
  value?: number;
  onChange: (trackId: string, rating: number) => void;
  trackId: string;
}> = ({ value, onChange, trackId }) => {
  const [localValue, setLocalValue] = useState(value);
  
  const handleChange = (newValue: number) => {
    setLocalValue(newValue);
    onChange(trackId, newValue);
    // Сохранение в StorageService выполняется в родителе или через хук
  };
  
  return (
    <div className="rating-cell">
      {/* Вариант A: Звёзды (10 половинчатых звёзд) */}
      <div className="stars">
        {[...Array(10)].map((_, i) => (
          <StarIcon 
            key={i}
            filled={i < (localValue || 0)}
            half={i === Math.floor(localValue || 0) && (localValue! % 1 !== 0)}
            onClick={() => handleChange(i + 1)}
          />
        ))}
      </div>
      
      {/* Вариант B: Числовой input (альтернатива) */}
      <input 
        type="number" 
        min={0} 
        max={10} 
        step={0.5}
        value={localValue || ''}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className="rating-input"
      />
      
      {/* Отображение текущего значения */}
      <span className="rating-value">{localValue?.toFixed(1) || '-'}</span>
    </div>
  );
};
```

### 2.5 Компонент: `ActionsCell` (кнопки действий)
**Файл**: `src/components/tracks/ActionsCell.tsx`

```tsx
export const ActionsCell: React.FC<{ track: Track }> = ({ track }) => {
  const openSessionDialog = useSessionDialog();
  
  return (
    <div className="actions-cell">
      {/* Кнопка открытия диалога сессии */}
      {track.conversationId && (
        <Tooltip content="Открыть диалог сессии">
          <button onClick={() => openSessionDialog(track.conversationId)}>
            <ChatIcon />
          </button>
        </Tooltip>
      )}
      
      {/* Ссылка на producer.ai */}
      <Tooltip content="Открыть на producer.ai">
        <a 
          href={track.sourceUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="action-link"
        >
          <ExternalLinkIcon />
        </a>
      </Tooltip>
      
      {/* Ссылка на профиль аккаунта (конфигурируется в настройках) */}
      <Tooltip content={`Профиль аккаунта ${track.accountId}`}>
        <a 
          href={`https://www.producer.ai/profile/account-${track.accountId}`} 
          target="_blank"
          rel="noopener noreferrer"
          className="action-link"
        >
          <UserIcon />
        </a>
      </Tooltip>
    </div>
  );
};
```

### 2.6 Пагинация и виртуализация
**Файл**: `src/components/controls/Pagination.tsx` + интеграция с `TrackTable`

```ts
// Хук useTracks.ts (упрощённо)
export const useTracks = (filters: TrackFilters) => {
  const [allTracks] = useStorageTracks(); // из IndexedDB
  const [settings] = useDisplaySettings();
  
  // Применение фильтров
  const filtered = useMemo(() => {
    return allTracks.filter(track => {
      if (filters.accountId && track.accountId !== filters.accountId) return false;
      if (filters.minRating && (track.rating || 0) < filters.minRating) return false;
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return (
          track.title.toLowerCase().includes(query) ||
          track.soundPrompt.toLowerCase().includes(query) ||
          track.lyrics?.toLowerCase().includes(query)
        );
      }
      // ... остальные фильтры
      return true;
    });
  }, [allTracks, filters]);
  
  // Сортировка
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Логика сортировки по полю и направлению
    });
  }, [filtered]);
  
  // Пагинация
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * settings.itemsPerPage;
    return sorted.slice(start, start + settings.itemsPerPage);
  }, [sorted, currentPage, settings.itemsPerPage]);
  
  return {
    tracks: paginated,
    total: sorted.length,
    // ... методы изменения страницы
  };
};
```

**Для >500 треков: виртуализация через `react-window`**
```tsx
import { FixedSizeList as List } from 'react-window';

export const VirtualTrackTable: React.FC<{ tracks: Track[] }> = ({ tracks }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <TrackRow track={tracks[index]} />
    </div>
  );
  
  return (
    <List
      height={600} // высота контейнера
      itemCount={tracks.length}
      itemSize={80} // высота одной строки
      width="100%"
    >
      {Row}
    </List>
  );
};
```

### 2.7 Панель фильтров и настроек отображения
**Файл**: `src/components/controls/FilterPanel.tsx` + `ColumnToggler.tsx`

```tsx
// FilterPanel
export const FilterPanel: React.FC<{
  filters: TrackFilters;
  onChange: (filters: TrackFilters) => void;
}> = ({ filters, onChange }) => {
  return (
    <div className="filter-panel">
      {/* Фильтр по аккаунту */}
      <select 
        value={filters.accountId || ''}
        onChange={(e) => onChange({
          ...filters, 
          accountId: e.target.value ? Number(e.target.value) as 1|2|3|4 : undefined
        })}
      >
        <option value="">Все аккаунты</option>
        <option value="1">Аккаунт 1</option>
        <option value="2">Аккаунт 2</option>
        <option value="3">Аккаунт 3</option>
        <option value="4">Аккаунт 4</option>
      </select>
      
      {/* Полнотекстовый поиск */}
      <SearchInput 
        value={filters.searchQuery}
        onChange={(query) => onChange({ ...filters, searchQuery: query })}
        placeholder="Поиск по названию, промпту, лирике..."
      />
      
      {/* Чекбоксы: hasPrompt, hasLyrics, hasSession */}
      <label>
        <input 
          type="checkbox"
          checked={filters.hasPrompt || false}
          onChange={(e) => onChange({ ...filters, hasPrompt: e.target.checked })}
        />
        Только с промптом
      </label>
      
      {/* Диапазон дат (использовать react-date-range или аналог) */}
      <DateRangePicker
        from={filters.dateRange?.from}
        to={filters.dateRange?.to}
        onChange={(range) => onChange({ ...filters, dateRange: range })}
      />
    </div>
  );
};

// ColumnToggler
export const ColumnToggler: React.FC<{
  settings: DisplaySettings;
  onChange: (settings: DisplaySettings) => void;
}> = ({ settings, onChange }) => {
  const toggleColumn = (column: keyof DisplaySettings['visibleColumns']) => {
    onChange({
      ...settings,
      visibleColumns: {
        ...settings.visibleColumns,
        [column]: !settings.visibleColumns[column]
      }
    });
  };
  
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>Колонки ▾</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {Object.entries(settings.visibleColumns).map(([key, visible]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={visible}
              onChange={() => toggleColumn(key as keyof typeof settings.visibleColumns)}
            />
            {formatColumnName(key)}
          </label>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
```

---

## 💬 ЭТАП 3: UI — ДИАЛОГ СЕССИИ (МОДАЛЬНОЕ ОКНО) (НЕДЕЛЯ 6)

### 3.1 Компонент: `SessionDialog` (модальное окно)
**Файл**: `src/components/sessions/SessionDialog.tsx`

```tsx
export const SessionDialog: React.FC<{
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
}> = ({ conversationId, isOpen, onClose }) => {
  const { data: session, isLoading } = useSession(conversationId);
  const { tracks } = useTracks({ conversationId });
  
  if (!isOpen) return null;
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <Modal.Header>
        <h3>Сессия: {conversationId.slice(0, 8)}...</h3>
        {session?.meta && (
          <Badge>{session.meta.totalMessages} сообщений</Badge>
        )}
      </Modal.Header>
      
      <Modal.Body className="session-dialog-body">
        {isLoading ? (
          <Spinner />
        ) : session ? (
          <div className="session-content">
            {/* Список сообщений */}
            <MessageList messages={session.messages} />
            
            {/* Привязанные треки (мини-список) */}
            {session.linkedTracks.length > 0 && (
              <div className="linked-tracks">
                <h4>Привязанные треки ({session.linkedTracks.length})</h4>
                <div className="track-chips">
                  {session.linkedTracks.map(track => (
                    <TrackChip key={track.trackId} track={track} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState message="Сессия не найдена" />
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <button onClick={onClose}>Закрыть</button>
        <button onClick={() => exportSession(conversationId)}>
          Экспортировать
        </button>
      </Modal.Footer>
    </Modal>
  );
};
```

### 3.2 Компонент: `MessageList` и `MessageBubble`
**Файл**: `src/components/sessions/MessageList.tsx` + `MessageBubble.tsx`

```tsx
// MessageList
export const MessageList: React.FC<{ messages: SessionMessage[] }> = ({ messages }) => {
  return (
    <div className="message-list">
      {messages.map(message => (
        <MessageBubble 
          key={message.id} 
          message={message} 
          onFragmentSelect={handleFragmentSelect}
        />
      ))}
    </div>
  );
};

// MessageBubble
export const MessageBubble: React.FC<{
  message: SessionMessage;
  onFragmentSelect: (fragment: TextFragment) => void;
}> = ({ message, onFragmentSelect }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-header">
        <span className="role">{isUser ? 'Вы' : 'Producer.ai'}</span>
        {message.timestamp && (
          <span className="timestamp">{formatTime(message.timestamp)}</span>
        )}
      </div>
      
      <div className="message-content">
        {/* Рендеринг markdown с поддержкой code blocks */}
        <MarkdownRenderer content={message.content} />
        
        {/* Если есть привязанный трек — показать мини-карточку */}
        {message.linkedTrackId && message.audioMetadata && (
          <LinkedTrackPreview metadata={message.audioMetadata} />
        )}
        
        {/* Если есть фрагменты для выборки — показать интерактивную область */}
        {message.textFragments?.length > 0 && (
          <FragmentSelector 
            content={message.content}
            fragments={message.textFragments}
            onToggle={onFragmentSelect}
          />
        )}
      </div>
    </div>
  );
};
```

**Стилизация сообщений:**
```css
.message-bubble {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 16px;
  margin: 8px 0;
}

.message-bubble.user {
  margin-left: auto; /* выравнивание вправо */
  background: #e3f2fd; /* светло-голубой */
  border-bottom-right-radius: 4px;
}

.message-bubble.assistant {
  margin-right: auto; /* выравнивание влево */
  background: #f5f5f5; /* светло-серый */
  border-bottom-left-radius: 4px;
}

.message-content {
  /* Поддержка markdown: отступы, списки, код */
  line-height: 1.5;
}

.message-content pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
}
```

### 3.3 Компонент: `MarkdownRenderer`
**Файл**: `src/components/ui/MarkdownRenderer.tsx`

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Кастомизация рендеринга кода
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <pre className="code-block">
              <code className={className} {...props}>
                {children}
              </code>
              <button className="copy-code">Копировать</button>
            </pre>
          ) : (
            <code className={className} {...props}>{children}</code>
          );
        },
        // Ссылки открываются в новой вкладке
        a: ({ node, ...props }) => <a target="_blank" rel="noopener" {...props} />
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
```

### 3.4 Компонент: `FragmentSelector` (выборка фрагментов)
**Файл**: `src/components/sessions/FragmentSelector.tsx`

```tsx
export const FragmentSelector: React.FC<{
  content: string;
  fragments: TextFragment[];
  onToggle: (fragment: TextFragment) => void;
}> = ({ content, fragments, onToggle }) => {
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  
  const handleTextSelect = (e: React.MouseEvent<HTMLDivElement>) => {
    // Получаем выделенный текст и позиции
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const startIndex = getCharacterIndex(range.startContainer, range.startOffset);
      const endIndex = getCharacterIndex(range.endContainer, range.endOffset);
      setSelection({ start: startIndex, end: endIndex });
    }
  };
  
  const createFragment = () => {
    if (!selection) return;
    
    const text = content.slice(selection.start, selection.end);
    const newFragment: TextFragment = {
      fragmentId: crypto.randomUUID(),
      text,
      startIndex: selection.start,
      endIndex: selection.end,
      isSelected: true,
      createdAt: new Date().toISOString()
    };
    
    onToggle(newFragment);
    setSelection(null);
  };
  
  return (
    <div className="fragment-selector">
      <div 
        className="selectable-content"
        onMouseUp={handleTextSelect}
        contentEditable={false}
      >
        {content}
      </div>
      
      {selection && (
        <div className="selection-toolbar">
          <span>Выделено: {selection.end - selection.start} симв.</span>
          <button onClick={createFragment}>
            + Привязать к треку
          </button>
          <button onClick={() => setSelection(null)}>Отмена</button>
        </div>
      )}
      
      {/* Список уже созданных фрагментов */}
      {fragments.length > 0 && (
        <div className="fragments-list">
          <h5>Привязанные фрагменты:</h5>
          {fragments.map(fragment => (
            <div key={fragment.fragmentId} className="fragment-item">
              <span className="fragment-text">"{fragment.text.slice(0, 50)}..."</span>
              <div className="fragment-actions">
                <input
                  type="checkbox"
                  checked={fragment.isSelected}
                  onChange={() => onToggle({ ...fragment, isSelected: !fragment.isSelected })}
                />
                <button 
                  onClick={() => navigateToTrack(fragment.linkedTrackId)}
                  disabled={!fragment.linkedTrackId}
                >
                  Перейти к треку
                </button>
                <button onClick={() => deleteFragment(fragment.fragmentId)}>
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 🔗 ЭТАП 4: ПРИВЯЗКА ФРАГМЕНТОВ И РУЧНОЕ РЕДАКТИРОВАНИЕ (НЕДЕЛЯ 7)

### 4.1 Логика автоматической привязки
**В `SessionExtractor.autoLinkTracksToMessages`:**
```ts
autoLinkTracksToMessages(session: ParsedSession): ParsedSession {
  return {
    ...session,
    messages: session.messages.map(message => {
      // Если сообщение ассистента содержит audioMetadata → создать фрагмент
      if (message.role === 'assistant' && message.audioMetadata) {
        const existingFragments = message.textFragments || [];
        
        // Эвристика: найти в content упоминание title или prompt
        const promptIndex = message.content.indexOf(message.audioMetadata.prompt);
        if (promptIndex !== -1) {
          const fragment: TextFragment = {
            fragmentId: crypto.randomUUID(),
            text: message.audioMetadata.prompt,
            startIndex: promptIndex,
            endIndex: promptIndex + message.audioMetadata.prompt.length,
            isSelected: true,
            linkedTrackId: message.audioMetadata.trackId,
            createdAt: new Date().toISOString()
          };
          
          return {
            ...message,
            textFragments: [...existingFragments, fragment]
          };
        }
      }
      return message;
    })
  };
}
```

### 4.2 Ручное редактирование привязок
**Через `FragmentSelector` и `LinkManager`:**
- [ ] Выделение блока текста → кнопка "Привязать к треку" → модальный список треков с тем же `conversation_id`
- [ ] Редактирование текста фрагмента (inline или в модалке)
- [ ] Удаление фрагмента с подтверждением
- [ ] Изменение статуса `isSelected` (чекбокс)
- [ ] Отмена/повтор действий (опционально: простой undo-stack)

### 4.3 Хранение привязок
**Файл**: `public/local-data/links/fragment_links.json`
```json
{
  "fed15fa7-0a64-47a0-ad4e-4d12106107f2": {
    "fragments": [
      {
        "fragmentId": "frag_abc123",
        "messageId": "msg_xyz789",
        "text": "anti-grid stochastic rhythm...",
        "isSelected": true,
        "createdAt": "2026-04-14T10:30:00Z",
        "updatedAt": "2026-04-14T10:35:00Z"
      }
    ],
    "manualOverrides": {
      "forceLinkedMessageId": "msg_def456",
      "excludeFragments": ["frag_exclude1"]
    }
  }
}
```

**Синхронизация:**
- При изменении фрагмента в UI → обновить `StorageService` → сохранить в IndexedDB
- При загрузке сессии → загрузить привязки из `fragment_links.json` → применить к `messages`

---

## 📦 ЭТАП 5: ЭКСПОРТ, АГРЕГАЦИЯ И ДОПОЛНИТЕЛЬНЫЕ ВОЗМОЖНОСТИ

### 5.1 Экспорт данных
**Файл**: `src/services/ExportService.ts`

```ts
export interface IExportService {
  /**
   * Экспортирует все треки в JSON
   */
  exportTracks(format: 'json' | 'csv'): Promise<Blob>;
  
  /**
   * Экспортирует сессию в Markdown (для чтения)
   */
  exportSessionAsMarkdown(conversationId: string): Promise<string>;
  
  /**
   * Экспортирует выбранные фрагменты в структурированный JSON
   */
  exportSelectedFragments(): Promise<Blob>;
  
  /**
   * Создаёт резервную копию всех локальных данных
   */
  createBackup(): Promise<Blob>;
}
```

**Формат CSV для треков:**
```csv
id,title,accountId,duration,createdAt,rating,soundPrompt,lyrics,conversationId,sourceUrl
fed15fa7...,Φ_TOTAL_ANTI_PATTERN_v1,4,146.144,2026-04-12T11:53:12Z,8,"anti-grid stochastic rhythm...","[Instrumental]",f1ff1a79...,https://...
```

### 5.2 Агрегация сессий в единый файл
**Скрипт**: `src/utils/aggregateSessions.ts`
```ts
export const aggregateAllSessions = async (
  sessions: ParsedSession[]
): Promise<AggregatedSessionsFile> => {
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    totalSessions: sessions.length,
    totalTracks: sessions.reduce((sum, s) => sum + s.linkedTracks.length, 0),
    sessions: Object.fromEntries(
      sessions.map(s => [s.conversationId, {
        messages: s.messages,
        linkedTracks: s.linkedTracks.map(t => ({
          trackId: t.trackId,
          title: t.title,
          prompt: t.prompt
        })),
        meta: s.meta
      }])
    ),
    index: sessions.map(s => ({
      conversationId: s.conversationId,
      primaryAccountId: s.primaryAccountId,
      trackCount: s.linkedTracks.length,
      messageCount: s.meta.totalMessages
    }))
  };
};
```

### 5.3 Дополнительные возможности (по приоритету)
- [ ] **Поиск по фрагментам**: полнотекстовый поиск внутри `sound_prompt` и выбранных фрагментов
- [ ] **Теги для треков**: ручная категоризация (например, "neurofunk", "ambient", "experimental")
- [ ] **Визуализация**: облако тегов промптов, график генераций по времени, распределение оценок
- [ ] **Горячие клавиши**: 
  - `Space` — play/pause предпросмотра
  - `Ctrl+K` — фокус на поиск
  - `Ctrl+Shift+S` — открыть настройки колонок
  - `Esc` — закрыть модалку
- [ ] **Темная/светлая тема**: переключатель в хедере, сохранение в `settings.json`

---

## 🛠️ ТЕХНИЧЕСКИЙ СТЕК И КОНФИГУРАЦИЯ

### Зависимости (`package.json`)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "@tanstack/react-table": "^8.11.0",
    "react-window": "^1.8.10",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",
    "howler": "^2.2.4",
    "date-fns": "^3.3.0",
    "uuid": "^9.0.1",
    "idb": "^7.1.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/howler": "^2.2.11",
    "@types/uuid": "^9.0.7",
    "@types/react-window": "^1.8.8",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0"
  }
}
```

### Конфигурация Vite (`vite.config.ts`)
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
  // Для работы с локальными файлами в dev-режиме
  publicDir: 'public',
});
```

### Конфигурация TypeScript (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## 🧪 ТЕСТИРОВАНИЕ И ВАЛИДАЦИЯ

### Юнит-тесты (Vitest)
**Файл**: `src/services/__tests__/MetaParser.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { MetaParser } from '../MetaParser';

describe('MetaParser', () => {
  const sampleMeta = { /* реальный пример из архива */ };
  
  it('должен корректно парсить обязательные поля', () => {
    const track = MetaParser.parseMetaJson(
      JSON.stringify(sampleMeta), 
      4, 
      '/mock/path/meta.json'
    );
    
    expect(track.id).toBe('fed15fa7-0a64-47a0-ad4e-4d12106107f2');
    expect(track.title).toBe('Φ_TOTAL_ANTI_PATTERN_v1');
    expect(track.accountId).toBe(4);
    expect(track.soundPrompt).toContain('anti-grid stochastic rhythm');
  });
  
  it('должен обрабатывать отсутствующие опциональные поля', () => {
    const minimalMeta = { id: 'test', title: 'Test', raw_data: { operation: { sound_prompt: 'test' } } };
    const track = MetaParser.parseMetaJson(JSON.stringify(minimalMeta), 1, '/test');
    
    expect(track.durationSeconds).toBeUndefined();
    expect(track.lyrics).toBe('[Instrumental]');
  });
});
```

### Интеграционные тесты
- [ ] Тест пайплайна импорта: моковый `FileSystemService` → `ImportOrchestrator.runFullImport()` → проверка результата
- [ ] Тест фильтрации: загрузить 100 моковых треков → применить фильтры → проверить количество результатов
- [ ] Тест привязки фрагментов: создать фрагмент → сохранить → перезагрузить → проверить сохранение

### E2E-тесты (опционально, Playwright)
```ts
// tests/import-flow.spec.ts
test('полный импорт архива', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="import-button"]');
  await page.setInputFiles('input[type="file"]', './mock-archive');
  await expect(page.getByText('Импорт завершён')).toBeVisible();
  await expect(page.locator('.track-row')).toHaveCount(1247);
});
```

### Валидация данных
**Файл**: `src/utils/validation.ts` (с использованием `zod`)
```ts
import { z } from 'zod';

export const TrackSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  accountId: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  coverUrl: z.string(),
  audioUrl: z.string(),
  createdAt: z.string().datetime(),
  soundPrompt: z.string(),
  // ... остальные поля
});

export const validateTrack = (data: unknown): Track => {
  return TrackSchema.parse(data);
};
```

---

## ✅ КРИТЕРИИ ГОТОВНОСТИ ПО ЭТАПАМ

### Этап 1 (Data Layer) — готово, когда:
- [ ] `ImportOrchestrator.runFullImport()` успешно обрабатывает реальный архив (4 аккаунта)
- [ ] Все найденные `meta.json` парсятся в валидные объекты `Track`
- [ ] Сессии извлекаются по `conversation_id` с точностью ≥95% (проверка на выборке 50 сессий)
- [ ] Автоматическая привязка треков к сообщениям работает для ≥90% случаев
- [ ] Данные сохраняются в IndexedDB и восстанавливаются после перезагрузки
- [ ] CLI-утилита `npm run import` работает с флагами `--dry-run` и `--verbose`
- [ ] Написаны юнит-тесты на ключевые функции парсинга и извлечения

### Этап 2 (Базовый UI) — готово, когда:
- [ ] Приложение запускается через `npm run dev` без ошибок
- [ ] Таблица отображает ≥100 треков с пагинацией (25/50/100 на страницу)
- [ ] Работает сортировка по всем колонкам, где `enableSorting: true`
- [ ] Фильтры (аккаунт, дата, рейтинг, поиск) корректно фильтруют данные
- [ ] Кнопка ▶️ на обложке воспроизводит 5-секундный предпросмотр
- [ ] Оценка 0-10 сохраняется и отображается после перезагрузки
- [ ] Настройки видимости колонок сохраняются в `localStorage`

### Этап 3 (Диалог сессии) — готово, когда:
- [ ] Клик на кнопку 💬 открывает модалку с данными сессии
- [ ] Сообщения отображаются с правильным выравниванием (user → вправо, assistant → влево)
- [ ] Markdown в контенте рендерится корректно (списки, код, ссылки)
- [ ] Привязанные треки отображаются в виде кликабельных чипсов
- [ ] Модалка закрывается по `Esc` и клику вне области

### Этап 4 (Фрагменты и привязки) — готово, когда:
- [ ] Выделение текста в сообщении показывает тулбар "Привязать к треку"
- [ ] Созданный фрагмент отображается в списке с чекбоксом `isSelected`
- [ ] Изменение `isSelected` сохраняется в хранилище
- [ ] Клик "Перейти к треку" скроллит таблицу к нужному треку и подсвечивает его
- [ ] Удаление фрагмента требует подтверждения и откатывается при отмене

### Этап 5 (Экспорт и агрегация) — готово, когда:
- [ ] Кнопка "Экспортировать треки" скачивает валидный JSON/CSV
- [ ] Экспорт сессии в Markdown сохраняет структуру диалога и привязки
- [ ] Функция агрегации создаёт единый файл `aggregated_sessions.json` с индексом
- [ ] Резервная копия содержит все локальные данные и может быть восстановлена

---

## 🚀 ПЛАН РАЗРАБОТКИ

| Неделя | Задача | Ожидаемый результат |
|--------|--------|---------------------|
| 1 | Настройка проекта, моковые данные, хранилище | Рабочий dev-сервер, моки треков/сессий, StorageService |
| 2 | FileSystemService + MetaParser | Парсинг реальных `meta.json` → `Track[]` |
| 3 | SessionExtractor + FragmentMapper | Извлечение сессий, авто-привязка треков |
| 4 | ImportOrchestrator + CLI | Полный пайплайн импорта, отчёт в консоли |
| 5 | TrackTable + базовые компоненты | Отображение 100+ треков с пагинацией и фильтрами |
| 6 | SessionDialog + MessageList | Модальное окно сессии с рендерингом markdown |
| 7 | FragmentSelector + ручное редактирование | Выделение текста, привязка к треку, управление фрагментами |
| 8 | ExportService + агрегация + полировка | Экспорт в JSON/CSV/MD, единый файл сессий, хоткеи, темы |

---

## 📝 ПРИМЕЧАНИЯ ДЛЯ WINDSURF

1. **Начинай с моковых данных**: реализуй весь UI на `public/mock-data/`, чтобы можно было разрабатывать фронтенд параллельно с бэкендом.

2. **Адаптивность**: делай desktop-first, но проверяй на ширине ≥1024px. Мобильная версия — опционально позже.

3. **Производительность**: при >500 треков обязательно используй `react-window`. Проверяй время рендера через React DevTools Profiler.

4. **Обработка ошибок**: каждый асинхронный вызов должен иметь `try/catch` с логированием в `LogMessage` и отображением ошибки в интерфейсе (тосты или inline-сообщения).

5. **Локализация**: весь интерфейс на русском (согласно предпочтениям пользователя), но ключи строк выноси в `src/constants/i18n.ts` для возможного расширения.

6. **Доступность (a11y)**: 
   - Все интерактивные элементы должны иметь `aria-label`
   - Поддержка навигации с клавиатуры (Tab, Enter, Esc)
   - Контрастность цветов ≥ 4.5:1 для текста

7. **Документация**: 
   - Добавь `README.md` с инструкцией по запуску и импорту
   - Документируй публичные API сервисов в JSDoc
   - Веди `CHANGELOG.md` с отметками о версиях

---

## 🔁 СЛЕДУЮЩИЕ ШАГИ

После утверждения этого ТЗ для Windsurf необходимо:

1. **Сгенерировать базовую структуру проекта** согласно разделу 📁 СТРУКТУРА ПРОЕКТА
2. **Реализовать типы** из 🧱 ПОЛНЫЕ ТИПЫ ДАННЫХ в `src/types/index.ts`
3. **Создать моковые данные** в `public/mock-data/` на основе предоставленных примеров `meta.json`
4. **Реализовать StorageService** с адаптерами IndexedDB/LocalStorage/Mock
5. **Написать первые юнит-тесты** на `MetaParser.parseMetaJson()`
