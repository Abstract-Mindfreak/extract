# 📚 **Референс-шпаргалка по двум полезным репозиториям**
## *Для решения проблем при реализации MMSS-архиватора*

> ⚠️ **Важно:** Это справочник на случай возникновения проблем. Аутентификация и токены НЕ трогаем — всё, что связано с Supabase/refresh/cookies, оставляем как есть.

---

## 🗺️ **Карта быстрого доступа: Проблема → Решение**

| Проблема | Репозиторий | Файл |
|----------|-------------|------|
| Не могу вытащить BPM/Key/жанр | Skquark | `src/downloaders/metadataExtractor.js` |
| Не встраиваются ID3 теги в MP3 | Skquark | `src/utils/metadataTagger.js` |
| Прерывается длинная загрузка | Skquark | `src/utils/progressTracker.js` |
| Не знаю как парсить SSE стрим | genz27 | `internal/service/flowmusic.go` |
| Не понимаю структуру Clip | genz27 | `internal/domain/clip.go` |
| Нужна структура MediaRef (audio/wav/video) | genz27 | `internal/domain/media.go` |
| Хочу реализовать fallback при ошибке | genz27 | `internal/service/accounts.go` |
| Нужна идея для кэша файлов | genz27 | `internal/storage/` (любой файл) |
| Не парсятся stems | Skquark | `src/downloaders/completeSongDownloader.js` |
| Нужна идея для CSV экспорта | Skquark | `src/exporters/csvExporter.js` |
| Не знаю как обрабатывать дубликаты | Skquark | `src/downloaders/songDownloader.js` |
| Нужна идея для title enhancement | Skquark | `src/utils/titleEnhancer.js` |
| Хочу понять real-time логи | genz27 | `internal/httpapi/handlers.go` |
| Нужна идея для web UI управления | genz27 | `web/static/` |

---

## 📦 **Раздел 1: Метаданные и парсинг**

### 🔍 **Если проблема: API не отдаёт BPM, Key, жанр**

**Где подсмотреть:** `Skquark/FlowMusicApp-Toolkit/src/downloaders/metadataExtractor.js`

**Что делает:** Извлекает метаданные прямо со страницы трека через DOM, когда API их не отдаёт.

**Полезные идеи:**
- Парсинг `img[alt]` для названия (иногда заголовок там, а не в явном поле)
- Извлечение duration из `span.text-fg-2.w-8`
- Поиск BPM/Key в `data-testid` атрибутах

**Когда применять:** Если в вашем API-ответе отсутствуют музыкальные параметры — можно добавить fallback-парсинг страницы трека.

---

### 🔍 **Если проблема: Нужно встроить метаданные в MP3**

**Где подсмотреть:** `Skquark/FlowMusicApp-Toolkit/src/utils/metadataTagger.js`

**Что делает:** Использует `node-id3` для встраивания ID3 тегов в скачанный MP3.

**Полезный паттерн:**
```javascript
// Стандартные теги
const tags = {
  title: metadata.title,
  artist: metadata.artist,
  album: "FlowMusic Library",
  year: metadata.year,
  bpm: metadata.bpm?.toString(),
  
  // Custom TXXX теги для AI-метаданных
  userDefinedText: [
    { description: 'KEY', value: metadata.key },
    { description: 'MODEL', value: metadata.aiModel },
    { description: 'SONG_ID', value: metadata.songId },
    { description: 'PROMPT', value: metadata.prompt }
  ],
  
  // Обложка
  image: { mime: 'image/jpeg', type: { id: 3 }, imageBuffer: coverBuffer },
  
  // Текст песни
  unsynchronisedLyrics: { language: 'eng', text: metadata.lyrics }
};
```

**Когда применять:** Если ваш существующий скрипт `embed-metadata.sh` не справляется с какими-то тегами — посмотрите как они работают с `node-id3`.

---

## 📦 **Раздел 2: Скачивание файлов**

### 🔍 **Если проблема: Прерывается длинная загрузка (1000+ треков)**

**Где подсмотреть:** `Skquark/FlowMusicApp-Toolkit/src/utils/progressTracker.js`

**Что делает:** Реализует систему чекпоинтов для возобновления загрузки.

**Полезная идея:**
```javascript
// checkpoint.json
{
  "downloadedIds": ["uuid1", "uuid2", ...],
  "failedItems": [{ "id": "uuid3", "error": "...", "timestamp": "..." }],
  "lastUpdated": "2026-06-12T10:30:00Z",
  "totalItems": 700
}
```

**Когда применять:** Если ваш архиватор падает на середине и приходится начинать заново.

---

### 🔍 **Если проблема: Не знаю как скачивать stems**

**Где подсмотреть:** `Skquark/FlowMusicApp-Toolkit/src/downloaders/completeSongDownloader.js`

**Что делает:** Скачивает треки вместе со stems через UI-кнопку "Get stems".

**Полезная идея:** Stems приходят как ZIP-архив. Если у вас есть URL для stems — скачивайте как обычный файл и распаковывайте.

---

### 🔍 **Если проблема: Дубликаты файлов**

**Где подсмотреть:** `Skquark/FlowMusicApp-Toolkit/src/downloaders/songDownloader.js`

**Что делает:** Проверяет дубликаты по ID трека + добавляет суффикс при конфликте имён файлов.

**Полезная идея:**
```javascript
// Проверка перед скачиванием
if (downloadedIds.has(track.id)) {
  console.log(`Skipping duplicate: ${track.id}`);
  continue;
}

// Если файл с таким именем уже есть — добавляем ID
let filename = sanitize(track.title);
if (fs.existsSync(`${filename}.mp3`)) {
  filename = `${filename}_${track.id.slice(0, 8)}`;
}
```

**Когда применять:** В вашем MMSS-архиваторе это уже реализовано через `audio_md5`, но паттерн с ID-суффиксом полезен для обложек и видео.

---

## 📦 **Раздел 3: Структуры данных**

### 🔍 **Если проблема: Не понимаю структуру ответа API**

**Где подсмотреть:** `genz27/FlowMusic2API/internal/domain/clip.go`

**Что содержит:** Go-структура `ClipOutput` — точная копия того, что возвращает Flow Music API.

**Ключевые поля:**
```go
type ClipOutput struct {
    ID              string
    Title           string
    Audio           MediaRef   // MP3
    Wav             *MediaRef  // WAV (опционально)
    Image           *MediaRef  // Обложка
    Video           *MediaRef  // Видео
    Lyrics          string
    LyricsID        string
    SoundPrompt     string     // Промпт звука
    OperationID     string
    OperationType   string     // Тип операции (extend, remix, etc.)
    DurationSeconds float64
    CreatedAt       string
}
```

**Когда применять:** Если в вашем `raw_data` есть незнакомые поля — сверяйтесь с этой структурой.

---

### 🔍 **Если проблема: Не знаю как хранить ссылки на медиа**

**Где подсмотреть:** `genz27/FlowMusic2API/internal/domain/media.go`

**Что содержит:** Структура `MediaRef` — универсальный способ хранения ссылок на файлы.

**Полезная идея:**
```go
type MediaRef struct {
    OriginalURL   string  // URL из Flow Music (может истечь)
    URL           string  // Кэшированный URL
    LocalURL      string  // Локальный путь после скачивания
    ContentType   string  // audio/mpeg, video/mp4, etc.
    Size          int64   // Размер в байтах
}
```

**Когда применять:** В вашей MMSS-схеме можно адаптировать этот паттерн для `core_audio.urls`, `video_subsystem`, `stems`.

---

### 🔍 **Если проблема: Не понимаю какие бывают operation_type**

**Где подсмотреть:** `genz27/FlowMusic2API/internal/service/generation.go`

**Что содержит:** Обработка различных типов операций генерации.

**Известные типы:**
- `generate` — первичная генерация
- `extend` — продление трека
- `cover` — кавер
- `replace` — замена части
- `variation` — вариация
- `trim` — обрезка

**Когда применять:** Для вашего поля `generation_logic.transform.type`.

---

## 📦 **Раздел 4: SSE стриминг**

### 🔍 **Если проблема: Хочу получать результаты генерации в реальном времени**

**Где подсмотреть:** `genz27/FlowMusic2API/internal/service/flowmusic.go`

**Что делает:** Реализует SSE-клиент для стриминга сообщений из `/__api/messages/{job_id}/stream`.

**Полезная идея:**
```go
// Чтение SSE событий
resp, _ := client.Do(req)
reader := bufio.NewReader(resp.Body)

for {
    line, _ := reader.ReadString('\n')
    if strings.HasPrefix(line, "data: ") {
        data := strings.TrimPrefix(line, "data: ")
        // Парсинг JSON события
        var event StreamEvent
        json.Unmarshal([]byte(data), &event)
        
        // Извлечение clip_ids, operation_ids
        if event.ClipIDs != nil {
            clipIDs = append(clipIDs, event.ClipIDs...)
        }
    }
}
```

**Когда применять:** Если захотите добавить real-time мониторинг генераций в ваш архиватор.

---

## 📦 **Раздел 5: Обработка ошибок**

### 🔍 **Если проблема: Нужна стратегия retry и fallback**

**Где подсмотреть:** `genz27/FlowMusic2API/internal/service/accounts.go`

**Что делает:** Реализует умный выбор аккаунта с fallback-логикой.

**Полезные паттерны:**

**1. Исключение сбойных аккаунтов:**
```go
excludedAccounts := make(map[int64]struct{})
for attempts := 0; attempts < maxAttempts; attempts++ {
    account := selectAccount(excludedAccounts)
    err := tryGeneration(account)
    if isAuthFailure(err) {
        excludedAccounts[account.ID] = struct{}{}
        continue  // Пробуем следующий
    }
    if err != nil {
        return err
    }
    return nil
}
```

**2. Fallback chain для токенов:**
```
refresh_token → provider_token → cookies → skip
```

**Когда применять:** Для вашего парсера — если какой-то эндпоинт возвращает ошибку, можно пробовать альтернативные пути получения данных.

---

## 📦 **Раздел 6: Кэширование**

### 🔍 **Если проблема: Хочу кэшировать скачанные файлы**

**Где подсмотреть:** `genz27/FlowMusic2API/internal/storage/`

**Что содержит:** Три режима хранения:
- `local.go` — локальный диск
- `s3.go` — S3-compatible
- `r2.go` — Cloudflare R2

**Полезная идея:** Интерфейс хранилища:
```go
type Storage interface {
    Save(key string, data []byte) error
    Load(key string) ([]byte, error)
    Exists(key string) bool
    GetURL(key string) string
}
```

**Когда применять:** Если захотите добавить кэширование скачанных файлов с возможностью доступа по URL.

---

## 📦 **Раздел 7: Экспорт и каталогизация**

### 🔍 **Если проблема: Хочу экспортировать данные в CSV**

**Где подсмотреть:** `Skquark/FlowMusicApp-Toolkit/src/exporters/csvExporter.js`

**Что делает:** Экспортирует метаданные в CSV для импорта в WordPress/аналитику.

**Полезные колонки:**
```javascript
{
  'Title': metadata.title,
  'Artist': metadata.artist,
  'BPM': metadata.bpm,
  'Key': metadata.key,
  'Duration': metadata.duration.formatted,
  'Model': metadata.aiModel,
  'Prompt': metadata.prompt,
  'Lyrics': metadata.lyrics,
  'Audio File': metadata.files.audio,
  'FlowMusic URL': metadata.url,
  'Categories': `AI Music, Model: ${metadata.aiModel}`,
  'Tags': `${metadata.key}, ${metadata.bpm} BPM, ${metadata.genre}`
}
```

**Когда применять:** Для создания аналитических отчётов по вашей базе данных.

---

### 🔍 **Если проблема: Хочу улучшать заголовки треков**

**Где подсмотреть:** `Skquark/FlowMusicApp-Toolkit/src/utils/titleEnhancer.js`

**Что делает:** Автоматически улучшает "сырые" заголовки от AI.

**Полезные идеи:**
- Удаление мусорных суффиксов
- Извлечение хуков из текста песни
- Нормализация регистра

---

## 📦 **Раздел 8: Web UI (если захотите добавить)**

### 🔍 **Если проблема: Хочу веб-интерфейс для управления архивом**

**Где подсмотреть:** `genz27/FlowMusic2API/web/static/`

**Что содержит:** Простой HTML+JS интерфейс для:
- Управления аккаунтами
- Просмотра логов
- Тестирования моделей
- Мониторинга запросов

**Полезная идея:** Минималистичный UI без фреймворков — просто HTML + fetch API.

---

## 🎯 **Шпаргалка по конкретным файлам**

### **Skquark/FlowMusicApp-Toolkit**

| Файл | Что смотреть |
|------|--------------|
| [`src/downloaders/metadataExtractor.js`](https://github.com/Skquark/FlowMusicApp-Toolkit/blob/main/src/downloaders/metadataExtractor.js) | Парсинг BPM/Key/жанра из DOM |
| [`src/downloaders/completeSongDownloader.js`](https://github.com/Skquark/FlowMusicApp-Toolkit/blob/main/src/downloaders/completeSongDownloader.js) | Скачивание треков + stems |
| [`src/downloaders/songDownloader.js`](https://github.com/Skquark/FlowMusicApp-Toolkit/blob/main/src/downloaders/songDownloader.js) | Обработка дубликатов |
| [`src/utils/metadataTagger.js`](https://github.com/Skquark/FlowMusicApp-Toolkit/blob/main/src/utils/metadataTagger.js) | ID3 теги через node-id3 |
| [`src/utils/progressTracker.js`](https://github.com/Skquark/FlowMusicApp-Toolkit/blob/main/src/utils/progressTracker.js) | Checkpoint система |
| [`src/utils/titleEnhancer.js`](https://github.com/Skquark/FlowMusicApp-Toolkit/blob/main/src/utils/titleEnhancer.js) | Улучшение заголовков |
| [`src/utils/playlistManager.js`](https://github.com/Skquark/FlowMusicApp-Toolkit/blob/main/src/utils/playlistManager.js) | Работа с плейлистами |
| [`src/exporters/csvExporter.js`](https://github.com/Skquark/FlowMusicApp-Toolkit/blob/main/src/exporters/csvExporter.js) | Экспорт в CSV |
| [`config/scraper.config.js`](https://github.com/Skquark/FlowMusicApp-Toolkit/blob/main/config/scraper.config.js) | CSS селекторы Flow Music |

### **genz27/FlowMusic2API**

| Файл | Что смотреть |
|------|--------------|
| [`internal/domain/clip.go`](https://github.com/genz27/FlowMusic2API/blob/main/internal/domain/clip.go) | Структура ClipOutput |
| [`internal/domain/media.go`](https://github.com/genz27/FlowMusic2API/blob/main/internal/domain/media.go) | Структура MediaRef |
| [`internal/domain/account.go`](https://github.com/genz27/FlowMusic2API/blob/main/internal/domain/account.go) | Структура Account |
| [`internal/service/flowmusic.go`](https://github.com/genz27/FlowMusic2API/blob/main/internal/service/flowmusic.go) | SSE стриминг, API вызовы |
| [`internal/service/generation.go`](https://github.com/genz27/FlowMusic2API/blob/main/internal/service/generation.go) | Логика генерации |
| [`internal/service/accounts.go`](https://github.com/genz27/FlowMusic2API/blob/main/internal/service/accounts.go) | Fallback логика |
| [`internal/httpapi/handlers.go`](https://github.com/genz27/FlowMusic2API/blob/main/internal/httpapi/handlers.go) | HTTP handlers |
| [`internal/storage/local.go`](https://github.com/genz27/FlowMusic2API/blob/main/internal/storage/local.go) | Локальное кэширование |
| [`internal/storage/s3.go`](https://github.com/genz27/FlowMusic2API/blob/main/internal/storage/s3.go) | S3 кэширование |

---

## 💡 **Топ-5 идей, которые стоит адаптировать**

### **1. TXXX ID3 теги для AI-метаданных** (из Skquark)
Сохраняйте `SONG_ID`, `MODEL`, `PROMPT`, `KEY` в custom ID3 тегах — это позволит искать треки по AI-параметрам через любой аудио-плеер.

### **2. Checkpoint JSON** (из Skquark)
Сохраняйте прогресс парсинга в `checkpoint.json` — если архиватор упадёт на 500-м треке из 1000, сможете продолжить с 501-го.

### **3. MediaRef структура** (из genz27)
Универсальный способ хранения ссылок на медиа с полями `original_url`, `cached_url`, `local_path`, `content_type`, `size`.

### **4. OperationType enum** (из genz27)
Чёткий список типов операций: `generate`, `extend`, `cover`, `replace`, `variation`, `trim` — используйте для `generation_logic.transform.type`.

### **5. Fallback chain** (из genz27)
Если основной способ получения данных не работает — пробуйте альтернативный. Например, если API не отдаёт stems URL — парсите страницу трека.

---

## 🎯 **Когда обращаться к этому справочнику**

✅ **Обращайтесь, если:**
- API не отдаёт какие-то метаданные
- Прерывается длинная загрузка
- Не встраиваются ID3 теги
- Не понимаете структуру ответа API
- Нужна идея для кэширования/экспорта
- Хотите добавить real-time мониторинг

❌ **НЕ обращайтесь, если:**
- Проблемы с аутентификацией (у вас всё работает)
- Проблемы с токенами (не трогаем)
- Нужны новые API эндпоинты (используйте свои)

---

## 📌 **Итоговая заметка**

Этот справочник — ваш **аварийный набор инструментов**. Большинство времени вы будете работать со своим MMSS-архиватором без обращения к этим репозиториям. Но когда возникнет специфическая проблема — вы точно будете знать, **где подсмотреть решение** и **какой файл открыть**.
