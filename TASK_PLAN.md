# Resolution Plan: Producer.ai Archive Manager — React Application

**Статус:** В РАЗРАБОТКЕ  
**Дата начала:** 2026-04-14  
**Цель:** Создать React-приложение для управления архивом аудиотреков Producer.ai с 4 аккаунтов

---

## 🎯 ОБЗОР ПРОЕКТА

Приложение для импорта, управления и экспорта аудиотреков из Producer.ai с поддержкой:
- Импорта meta.json/audio/image из producer-ai-archiver/
- Извлечения сессий по conversation_id
- Привязки текстовых фрагментов к трекам
- UI: таблица треков, фильтры, оценки, диалог сессий
- Экспорта в JSON/CSV/Markdown

**Приоритет:** Сначала Data Layer (сбор/парсинг), затем UI

---

## 📋 ЭТАП 0: ПОДГОТОВКА И АНАЛИЗ

### 0.1 Инициализация проекта
- [x] **DONE** Проверить текущую конфигурацию react/my-app (React 19, Vite, работает)
  - React 18 + TypeScript
  - Vite в качестве сборщика
  - ESLint + Prettier
- [x] **DONE** Установлены базовые зависимости: zustand, idb (остальные по мере необходимости)

### 0.2 Настройка моковых данных
- [x] **DONE** Создан `public/mock-data/tracks.json` (12 треков)
- [x] **DONE** Создан `public/mock-data/sessions.json` (5 сессий)
- [x] **DONE** Реализован `src/services/MockDataService.js` (с batch-операциями)
  - `getMockTracks(): Promise<Track[]>`
  - `getMockSessions(): Promise<ParsedSession[]>`
  - `getMockTrackById(id: string): Promise<Track | null>`

### 0.3 Настройка хранилища
- [x] **DONE** Реализован `src/services/StorageService.js` с IndexedDB (idb)
  - `IndexedDBAdapter` — основное хранилище
  - `LocalStorageAdapter` — настройки и кэш
  - `MockAdapter` — для разработки
- [x] **DONE** Определены схемы хранилищ:
  - tracks, sessions, fragments, metadata, accounts
  - `tracks` → объект по `track.id`
  - `sessions` → объект по `session.conversationId`
  - `settings` → `DisplaySettings`
  - `ratings` → `{ [trackId: string]: number }`

---

## 🔧 ЭТАП 1: DATA LAYER — СБОР И ПАРСИНГ

### 1.1 Модуль: `FileSystemService`
**Файл:** `src/services/FileSystemService.ts`

- [x] **DONE** `FileSystemService.ts` — сканирование через File System Access API + fallback
  - `scanArchive(basePath, accountIds): Promise<ScanResult>`
  - `readFile(path): Promise<string>`
  - `writeFile(path, content): Promise<void>`
  - `pathToBlobUrl(filePath, mimeType): Promise<string>`
- [x] **DONE** File System Access API + fallback на processFileList
- [x] **DONE** Обработка ошибок: validateArchiveStructure, try/catch на всех операциях

### 1.2 Модуль: `MetaParser`
**Файл:** `src/services/MetaParser.ts`

- [x] **DONE** `MetaParser.ts` — валидация и парсинг meta.json
  - `parseMetaJson()`, `validateMetaJson()`, `extractDuration()`, `extractSoundPrompt()`
- [x] **DONE** Обязательные поля: id валидируется, title/created_at/sound_prompt извлекаются
- [x] **DONE** Опциональные поля: duration (undefined если нет), lyrics ('[Instrumental]' по умолчанию)
- [x] **DONE** `toPublicUrl()` — конвертация путей в публичные URLs

### 1.3 Модуль: `SessionExtractor`
**Файл:** `src/services/SessionExtractor.ts`

- [x] **DONE** `SessionExtractor.ts` — извлечение сессий из треков
  - `extractSessions()`, `reconstructMessagesFromTrack()`, `mergeDuplicateSessions()`, `autoLinkTracksToMessages()`
- [x] **DONE** Алгоритм извлечения:
  1. Группировка по `conversation_id`
  2. Сортировка по `created_at`
  3. Создание сообщений (user=prompt, assistant=результат)
  4. Дедупликация сообщений по контенту
  5. Авто-привязка треков по совпадению prompt

### 1.4 Модуль: `FragmentMapper`
**Файл:** `src/services/FragmentMapper.ts`

- [ ] **TO_DO** Реализовать `IFragmentMapper`:
  - `createFragment(messageId, content, startIndex, endIndex, linkedTrackId?): TextFragment`
  - `getFragmentsByTrack(trackId, sessions): TextFragment[]`
  - `toggleFragmentSelection(fragmentId, sessions): void`
  - `exportSelectedFragments(sessions): Record<string, TextFragment[]>`
- [ ] **TO_DO** Генерация `fragmentId` через `crypto.randomUUID()`
- [ ] **TO_DO** Валидация индексов: `startIndex < endIndex`, не выходят за границы

### 1.5 Модуль: `ImportOrchestrator`
**Файл:** `src/services/ImportOrchestrator.ts`

- [x] **DONE** `ImportOrchestrator.ts` — пайплайн полного импорта
  - `runFullImport()` — File System Access API
  - `runFileListImport()` — fallback на file input
  - `validateBeforeImport()` — проверка перед импортом
- [x] **DONE** Типы: `ImportStage`, `ImportResult`, `ImportProgressCallback`
- [x] **DONE** Пайплайн импорта:
  1. Сканирование через `FileSystemService`
  2. Парсинг через `MetaParser`
  3. Создание blob URLs для медиа
  4. Извлечение сессий через `SessionExtractor`
  5. Batch-сохранение в IndexedDB
  6. Сохранение метаданных импорта

### 1.6 CLI-утилита для импорта
**Файл:** `scripts/import-cli.ts`

- [x] **DONE** `import-cli.ts` — CLI на `commander` + `chalk`
  - `npm run import -- --input "./producer-ai-archiver" --accounts "1,2,3,4"`
- [x] **DONE** Флаги: `--input`, `--accounts`, `--output`, `--dry-run`, `--verbose`
- [x] **DONE** Цветной вывод (info/success/warning/error)
- [x] **DONE** Отчёт в `local-data/import-report.json`
- [x] **DONE** Скрипт в `package.json`: `"import": "ts-node scripts/import-cli.ts"`

**Критерии готовности Этапа 1:**
- [x] **DONE** `ImportOrchestrator.runFullImport()` — готово для тестирования
- [x] **DONE** `MetaParser.parseMetaJson()` — парсинг с валидацией
- [x] **DONE** `SessionExtractor.extractSessions()` — группировка по `conversation_id`
- [x] **DONE** `StorageService` — batch-сохранение в IndexedDB
- [x] **DONE** CLI-утилита работает с `--dry-run` и `--verbose`
- [x] **DONE** ✅ **Тестирование пройдено:** 327 треков, 979 файлов, 1.04 GB успешно импортированы!
- [x] **DONE** `LocalDataImporter` — импорт в IndexedDB из public/local-data/
- [ ] **PENDING** Юнит-тесты на ключевые функции

---

## 🎨 ЭТАП 2: UI — ТАБЛИЦА ТРЕКОВ И БАЗОВЫЙ ИНТЕРФЕЙС

### 2.1 Компонент: `TrackTable`
**Файл:** `src/components/tracks/TrackTable.tsx`

- [ ] **TO_DO** Интеграция `@tanstack/react-table`
- [ ] **TO_DO** Виртуализация через `react-window` при >100 элементов
- [ ] **TO_DO** Сортировка по клику на заголовок
- [ ] **TO_DO** Множественная сортировка (Shift+клик)
- [ ] **TO_DO** Адаптивная ширина колонок

**Конфигурация колонок:** `src/constants/columns.ts`
- [ ] **TO_DO** Определить `DEFAULT_COLUMNS`: cover, title, duration, createdAt, soundPrompt, lyrics, rating, actions

### 2.2 Компонент: `CoverCell`
**Файл:** `src/components/tracks/CoverCell.tsx`

- [ ] **TO_DO** Отображение обложки трека
- [ ] **TO_DO** Обработка hover: показать оверлей с play/pause
- [ ] **TO_DO** Предпросмотр при наведении (если `displaySettings.hoverPreview`)
- [ ] **TO_DO** Использовать `useAudioPlayer` хук
- [ ] **TO_DO** Стили: transition-opacity, иконки по центру, адаптивный размер

### 2.3 Компонент: `PromptCell`
**Файл:** `src/components/tracks/PromptCell.tsx`

- [ ] **TO_DO** Сворачиваемый текст промпта
- [ ] **TO_DO** Кнопки: "Развернуть/Свернуть", "Копировать"
- [ ] **TO_DO** Максимальная длина превью: 100 символов

### 2.4 Компонент: `RatingCell`
**Файл:** `src/components/tracks/RatingCell.tsx`

- [ ] **TO_DO** Отображение оценки 0-10
- [ ] **TO_DO** Вариант A: звёзды (10 половинчатых)
- [ ] **TO_DO** Вариант B: числовой input (min=0, max=10, step=0.5)
- [ ] **TO_DO** Сохранение при изменении через `StorageService`

### 2.5 Компонент: `ActionsCell`
**Файл:** `src/components/tracks/ActionsCell.tsx`

- [ ] **TO_DO** Кнопка открытия диалога сессии (если `conversationId`)
- [ ] **TO_DO** Ссылка на producer.ai (`sourceUrl`)
- [ ] **TO_DO** Ссылка на профиль аккаунта
- [ ] **TO_DO** Tooltip для всех кнопок

### 2.6 Пагинация и виртуализация
**Файлы:** `src/components/controls/Pagination.tsx`, `src/hooks/useTracks.ts`

- [ ] **TO_DO** Хук `useTracks` с фильтрацией, сортировкой, пагинацией
- [ ] **TO_DO** Компонент `Pagination` с номерами страниц
- [ ] **TO_DO** Настройка itemsPerPage: 25/50/100
- [ ] **TO_DO** Виртуализация через `react-window` для >500 треков

### 2.7 Панель фильтров и настроек
**Файлы:** `src/components/controls/FilterPanel.tsx`, `ColumnToggler.tsx`

- [ ] **TO_DO** `FilterPanel`:
  - Фильтр по аккаунту (1/2/3/4)
  - Полнотекстовый поиск
  - Чекбоксы: hasPrompt, hasLyrics, hasSession
  - Диапазон дат
- [ ] **TO_DO** `ColumnToggler`:
  - Dropdown с чекбоксами видимости колонок
  - Сохранение в `localStorage`

**Критерии готовности Этапа 2:**
- [ ] Приложение запускается без ошибок
- [ ] Таблица отображает ≥100 треков с пагинацией
- [ ] Работает сортировка по всем колонкам
- [ ] Фильтры корректно фильтруют данные
- [ ] Предпросмотр при наведении работает
- [ ] Оценка сохраняется и отображается после перезагрузки
- [ ] Настройки колонок сохраняются в `localStorage`

---

## 💬 ЭТАП 3: UI — ДИАЛОГ СЕССИИ

### 3.1 Компонент: `SessionDialog`
**Файл:** `src/components/sessions/SessionDialog.tsx`

- [ ] **TO_DO** Модальное окно (размер XL)
- [ ] **TO_DO** Заголовок с `conversationId` и количеством сообщений
- [ ] **TO_DO** Состояния: loading, error, empty
- [ ] **TO_DO** Тело: `MessageList` + привязанные треки
- [ ] **TO_DO** Футер: кнопки "Закрыть", "Экспортировать"

### 3.2 Компоненты: `MessageList`, `MessageBubble`
**Файлы:** `src/components/sessions/MessageList.tsx`, `MessageBubble.tsx`

- [ ] **TO_DO** `MessageList`: рендеринг списка сообщений
- [ ] **TO_DO** `MessageBubble`:
  - Выравнивание: user → вправо, assistant → влево
  - Рендеринг markdown через `react-markdown`
  - Показ мини-карточки привязанного трека
  - `FragmentSelector` если есть фрагменты

### 3.3 Компонент: `MarkdownRenderer`
**Файл:** `src/components/ui/MarkdownRenderer.tsx`

- [ ] **TO_DO** Интеграция `react-markdown` + `remark-gfm`
- [ ] **TO_DO** Кастомизация кода: блоки с кнопкой "Копировать"
- [ ] **TO_DO** Ссылки открываются в новой вкладке

### 3.4 Компонент: `FragmentSelector`
**Файл:** `src/components/sessions/FragmentSelector.tsx`

- [ ] **TO_DO** Выделение текста мышью
- [ ] **TO_DO** Тулбар с кнопкой "Привязать к треку"
- [ ] **TO_DO** Список созданных фрагментов с чекбоксами
- [ ] **TO_DO** Кнопки: "Перейти к треку", "Удалить"

**Критерии готовности Этапа 3:**
- [ ] Клик на 💬 открывает модалку с данными сессии
- [ ] Сообщения выравнены правильно (user/assistant)
- [ ] Markdown рендерится корректно
- [ ] Привязанные треки отображаются как кликабельные чипсы
- [ ] Модалка закрывается по `Esc` и клику вне области

---

## 🔗 ЭТАП 4: ПРИВЯЗКА ФРАГМЕНТОВ И РУЧНОЕ РЕДАКТИРОВАНИЕ

### 4.1 Логика автоматической привязки
- [ ] **TO_DO** `SessionExtractor.autoLinkTracksToMessages()`
- [ ] **TO_DO** Эвристика: найти `sound_prompt` в контенте сообщения
- [ ] **TO_DO** Создание `TextFragment` с позициями startIndex/endIndex

### 4.2 Ручное редактирование привязок
- [ ] **TO_DO** Выделение текста → кнопка "Привязать к треку"
- [ ] **TO_DO** Модальный список треков с тем же `conversation_id`
- [ ] **TO_DO** Редактирование текста фрагмента
- [ ] **TO_DO** Удаление фрагмента с подтверждением
- [ ] **TO_DO** Изменение статуса `isSelected` (чекбокс)

### 4.3 Хранение привязок
**Файл:** `public/local-data/links/fragment_links.json`

- [ ] **TO_DO** Структура: `{ [trackId]: { fragments: [], manualOverrides: {} } }`
- [ ] **TO_DO** Синхронизация: UI → `StorageService` → IndexedDB
- [ ] **TO_DO** Загрузка привязок при открытии сессии

**Критерии готовности Этапа 4:**
- [ ] Выделение текста показывает тулбар "Привязать к треку"
- [ ] Созданный фрагмент отображается в списке
- [ ] Изменение `isSelected` сохраняется
- [ ] "Перейти к треку" скроллит к треку и подсвечивает
- [ ] Удаление требует подтверждения

---

## 📦 ЭТАП 5: ЭКСПОРТ, АГРЕГАЦИЯ И ДОПОЛНИТЕЛЬНЫЕ ВОЗМОЖНОСТИ

### 5.1 Экспорт данных
**Файл:** `src/services/ExportService.ts`

- [ ] **TO_DO** `exportTracks(format: 'json' | 'csv'): Promise<Blob>`
- [ ] **TO_DO** `exportSessionAsMarkdown(conversationId): Promise<string>`
- [ ] **TO_DO** `exportSelectedFragments(): Promise<Blob>`
- [ ] **TO_DO** `createBackup(): Promise<Blob>`
- [ ] **TO_DO** Формат CSV с заголовками

### 5.2 Агрегация сессий
**Файл:** `src/utils/aggregateSessions.ts`

- [ ] **TO_DO** `aggregateAllSessions(sessions): AggregatedSessionsFile`
- [ ] **TO_DO** Генерация единого файла `aggregated_sessions.json`
- [ ] **TO_DO** Индекс сессий с метаданными

### 5.3 Дополнительные возможности (по приоритету)
- [ ] **TO_DO** Поиск по фрагментам внутри `sound_prompt`
- [ ] **TO_DO** Теги для треков (ручная категоризация)
- [ ] **TO_DO** Визуализация: облако тегов, график генераций
- [ ] **TO_DO** Горячие клавиши:
  - `Space` — play/pause
  - `Ctrl+K` — фокус на поиск
  - `Ctrl+Shift+S` — настройки колонок
  - `Esc` — закрыть модалку
- [ ] **TO_DO** Темная/светлая тема с переключателем

**Критерии готовности Этапа 5:**
- [ ] Экспорт треков в JSON/CSV работает
- [ ] Экспорт сессии в Markdown сохраняет структуру
- [ ] Агрегация создаёт валидный `aggregated_sessions.json`
- [ ] Резервная копия содержит все данные

---

## 🧪 ТЕСТИРОВАНИЕ И ВАЛИДАЦИЯ

### Юнит-тесты (Vitest)
- [ ] **TO_DO** `MetaParser.test.ts` — парсинг обязательных/опциональных полей
- [ ] **TO_DO** `SessionExtractor.test.ts` — группировка и дедупликация
- [ ] **TO_DO** `FragmentMapper.test.ts` — создание и валидация фрагментов
- [ ] **TO_DO** `StorageService.test.ts` — CRUD операции

### Интеграционные тесты
- [ ] **TO_DO** Тест пайплайна импорта: моковый `FileSystemService` → `ImportOrchestrator`
- [ ] **TO_DO** Тест фильтрации: 100 моковых треков → применение фильтров
- [ ] **TO_DO** Тест привязки фрагментов: создание → сохранение → загрузка

### E2E-тесты (Playwright, опционально)
- [ ] **TO_DO** Полный импорт архива через UI
- [ ] **TO_DO** Открытие сессии и привязка фрагмента

### Валидация данных
**Файл:** `src/utils/validation.ts` (с `zod`)

- [ ] **TO_DO** `TrackSchema` с валидацией UUID, полей
- [ ] **TO_DO** `validateTrack(data): Track`

---

## 🛠️ ТЕХНИЧЕСКИЙ СТЕК

### Основные зависимости
```json
{
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
  "idb": "^7.1.1",
  "zod": "^3.22.0"
}
```

### Dev Dependencies
- TypeScript 5.3+
- Vite 5.0+
- ESLint + Prettier
- Vitest (для тестов)

---

## 📅 ПЛАН РАЗРАБОТКИ

| Неделя | Задачи | Результат |
|--------|--------|-----------|
| 1 | Этап 0: Подготовка, моки, хранилище | Рабочий dev-сервер, моки, StorageService |
| 2 | Этап 1: FileSystemService + MetaParser | Парсинг meta.json → Track[] |
| 3 | Этап 1: SessionExtractor + FragmentMapper | Извлечение сессий, авто-привязка |
| 4 | Этап 1: ImportOrchestrator + CLI | Полный пайплайн импорта |
| 5 | Этап 2: TrackTable + базовые компоненты | Таблица с пагинацией и фильтрами |
| 6 | Этап 3: SessionDialog + MessageList | Модальное окно сессии |
| 7 | Этап 4: FragmentSelector + ручное редактирование | Привязка фрагментов |
| 8 | Этап 5: ExportService + агрегация + полировка | Экспорт, хоткеи, темы |

---

## 📝 ИНСТРУКЦИИ ДЛЯ WINDSURF

1. **Начинай с моковых данных** — реализуй весь UI на `public/mock-data/`, чтобы можно было разрабатывать фронтенд параллельно с бэкендом.

2. **Адаптивность** — делай desktop-first, проверяй на ширине ≥1024px.

3. **Производительность** — при >500 треков обязательно используй `react-window`.

4. **Обработка ошибок** — каждый асинхронный вызов должен иметь `try/catch` с логированием.

5. **Локализация** — весь интерфейс на русском, ключи строк в `src/constants/i18n.ts`.

6. **Доступность (a11y)**:
   - Все интерактивные элементы с `aria-label`
   - Навигация с клавиатуры (Tab, Enter, Esc)
   - Контрастность ≥ 4.5:1

7. **Документация**:
   - JSDoc для публичных API
   - `CHANGELOG.md` с отметками о версиях

---

## ✅ ТЕКУЩИЙ СТАТУС

**Последнее обновление:** 2026-04-14  
**Готовность:** 55% (Импорт реальных данных работает!)  
**Следующая задача:** Этап 2 — UI таблицы треков (виртуализация для 327+ треков)

---

**Примечания:**
- Приоритет: Этап 1 (Data Layer) критичен для всего остального
- prompt-db-local отложен — работа только в react/my-app
- Данные хранятся локально (IndexedDB), без сервера
