Перед началом выполнения данного задания - нужно сделать гит комит и гит пуш. По оканчанию TASK нужно добавить в gitignor данные которые не должны попадать в репозиторий - например данные базы данных и приватная информация об аккаунтах (на данный момент 4 аккаунта подключены)

# 📋 **TASK.md: Flow Music Archiver v2 — MMSS-Upgrade**

## 🎯 **Обзор проекта**

### **Контекст**
Проект MMSS (Master Meta-Schema) — это система архивации и анализа генераций Flow Music (ранее Producer.ai), предназначенная для создания базы знаний промптов, отслеживания эволюции треков и выявления паттернов успешных генераций.

### **Текущее состояние**
- ✅ Базовый парсер работает (`archiver.mjs`)
- ✅ Скачивание аудио, обложек, метаданных
- ✅ Парсинг сессий
- ⚠️ Неполные метаданные (отсутствуют stems, video jobs, AI snapshot)
- ⚠️ Нет графа связей между треками
- ⚠️ Порядок парсинга неоптимальный

### **Цели обновления**
1. **Полнота данных:** Внедрить MMSS-структуру с полным покрытием всех сущностей
2. **Оптимизация пайплайна:** Изменить порядок парсинга для построения графа связей ДО скачивания файлов
3. **Новые метаданные:** Добавить lineage, sampling context, engagement metrics
4. **Масштабируемость:** Подготовить архитектуру для PostgreSQL с возможностью переключения БД
5. **Автоматизация:** Интеграция со скриптом встраивания метаданных в аудиофайлы

---

## 🏗️ **Архитектурные решения**

### **Решение 1: Стратегия обновления (ВЫБРАНО)**
**Вариант:** Изменения в текущей реализации + переключение БД через конфиг

**Обоснование:**
- ✅ Git обеспечивает возможность отката
- ✅ Не нужно дублировать код и настройки
- ✅ Проще поддерживать единую кодовую базу
- ✅ Переключение БД — это одна строка в `.env`

**Реализация:**
```javascript
// .env
DB_MODE=v2  // v1 | v2
DB_NAME_V1=flowmusic_archive
DB_NAME_V2=abstract-mind-lab
DB_PASSWORD=***
```

```javascript
// config.js
const DB_CONFIG = {
  v1: {
    name: process.env.DB_NAME_V1,
    schema: 'legacy'
  },
  v2: {
    name: process.env.DB_NAME_V2,
    schema: 'mmss'
  }
};

const activeDB = DB_CONFIG[process.env.DB_MODE || 'v2'];
```

### **Решение 2: Оптимизированный пайплайн**

#### **ФАЗА 1: Сбор структурных данных (без скачивания файлов)**
```javascript
// 1.1. Получаем ВСЕ сессии
const sessions = await fetchAllSessions();

// 1.2. Получаем ВСЕ треки с метаданными (без файлов)
const tracks = await fetchAllTracksMetadata();

// 1.3. Строим граф связей ДО скачивания
const relationGraph = buildRelationGraph(tracks);
// - parent-child (remix, extend, variation)
// - stems (parent → children)
// - video jobs (track → video)
// - session membership (track → session)

// 1.4. Получаем видео-джобы и привязываем
const videoJobs = await fetchVideoJobs();
attachVideoToTracks(tracks, videoJobs);

// 1.5. Получаем AI snapshot для каждой сессии
for (const session of sessions) {
  const aiSnapshot = await fetchAISnapshot(session.id);
  session.ai_snapshot = aiSnapshot;
}
```

#### **ФАЗА 2: Обогащение и JOIN**
```javascript
// 2.1. JOIN сессий и треков
const enrichedTracks = joinSessionsWithTracks(sessions, tracks);

// 2.2. Обогащение stems
enrichStemsWithParentData(enrichedTracks);

// 2.3. Обогащение видео метаданными
enrichVideoMetadata(enrichedTracks);

// 2.4. Обогащение lineage (генеалогия)
enrichLineage(enrichedTracks, relationGraph);

// 2.5. Применяем MMSS-маппинг
const mmssEntries = enrichedTracks.map(track => mapTrackToMMSS(track));
```

#### **ФАЗА 3: Скачивание файлов (только нужных)**
```javascript
// 3.1. Скачиваем ТОЛЬКО те файлы, которые есть в MMSS
for (const entry of mmssEntries) {
  // Проверяем хэш для дедупликации
  if (entry.analytics_and_meta.technical_specs.audio_md5) {
    const exists = await checkFileExists(entry.analytics_and_meta.technical_specs.audio_md5);
    if (exists) continue;
  }
  
  if (entry.core_audio.urls.download_mp3) {
    await downloadFile(entry.core_audio.urls.download_mp3);
  }
  if (entry.video_subsystem.video_url) {
    await downloadFile(entry.video_subsystem.video_url);
  }
  for (const stem of entry.core_audio.stems.children_stems || []) {
    if (stem.url) await downloadFile(stem.url);
  }
}

// 3.2. Скачиваем обложки
for (const entry of mmssEntries) {
  if (entry.core_audio.urls.image_url) {
    await downloadFile(entry.core_audio.urls.image_url);
  }
}
```

#### **ФАЗА 4: Пост-обработка**
```javascript
// 4.1. Встраивание метаданных в аудиофайлы
for (const entry of mmssEntries) {
  await embedMetadata(entry); // Вызов существующего скрипта
}

// 4.2. Сохранение в PostgreSQL
await saveToPostgreSQL(mmssEntries, activeDB);
```

---

## 🗄️ **Новая структура PostgreSQL (MMSS Schema)**

### **Имя БД:** `abstract-mind-lab`  
### **Пароль и имя пользоватля:** такой же как на текущей БД

```sql
-- ============================================
-- MAIN TABLE: tracks (MMSS-структура)
-- ============================================
CREATE TABLE tracks (
  id UUID PRIMARY KEY,
  entry_id UUID UNIQUE NOT NULL,
  
  -- Core Audio
  title TEXT,
  seed BIGINT,
  duration_s REAL,
  created_at TIMESTAMPTZ,
  
  -- URLs
  stream_url TEXT,
  mp3_url TEXT,
  wav_url TEXT,
  image_url TEXT,
  
  -- Project Context
  is_project BOOLEAN DEFAULT FALSE,
  project_id UUID,
  session_id UUID,
  storage_tier VARCHAR(50) DEFAULT 'active_archive',
  
  -- Generation Logic
  model_name VARCHAR(100),
  generation_mode VARCHAR(50), -- standard | fast
  ghostwriter_tier VARCHAR(50), -- standard | pro
  instrument VARCHAR(100), -- Lyria 3 Pro, etc.
  prompt TEXT,
  negative_prompt TEXT,
  prompt_strength REAL,
  
  -- Transform/Remix
  transform_type VARCHAR(50), -- extend, remix, cover, replace, trim
  remix_mode VARCHAR(50), -- variation, cover, replace, extend, trim, use_prompt
  parent_riff_id UUID,
  parent_clip_id UUID,
  offset_s REAL,
  clip_start_s REAL,
  clip_end_s REAL,
  trim_start_s REAL,
  trim_end_s REAL,
  
  -- Video
  has_video BOOLEAN DEFAULT FALSE,
  video_job_id VARCHAR(100),
  video_status VARCHAR(50),
  video_url TEXT,
  video_aspect_ratio VARCHAR(20),
  video_motion_score REAL,
  video_style_ref_url TEXT,
  video_start_s REAL,
  video_end_s REAL,
  video_prompt TEXT,
  video_fps INTEGER,
  video_resolution VARCHAR(50),
  
  -- Stems
  is_stem_composite BOOLEAN DEFAULT FALSE,
  stem_type VARCHAR(50), -- vocals, drums, bass, other
  
  -- Spaces
  is_space BOOLEAN DEFAULT FALSE,
  space_id UUID,
  
  -- Privacy & Social
  privacy_status VARCHAR(50), -- public, unlisted, private
  is_discoverable BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  is_derivative BOOLEAN DEFAULT FALSE,
  source_user_id UUID,
  original_track_id UUID,
  
  -- Statistics
  play_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  skip_count INTEGER DEFAULT 0,
  skip_ratio REAL,
  completion_rate REAL,
  avg_completion_pct REAL,
  is_favorited_by_me BOOLEAN DEFAULT FALSE,
  
  -- Lineage (Генеалогия)
  origin_id UUID, -- UUID самого первого предка
  derivation_depth INTEGER DEFAULT 0, -- 0 = оригинал, 1 = ремикс, 2 = ремикс ремикса
  branch_index INTEGER, -- индекс ветви (1-5 если от предка сделано 5 вариаций)
  
  -- Technical Specs
  audio_md5 VARCHAR(32), -- для дедупликации
  audio_codec VARCHAR(50),
  bitrate_kbps INTEGER,
  sample_rate_hz INTEGER,
  
  -- Sampling Context
  cfg_scale REAL,
  sampling_steps INTEGER,
  internal_model_id VARCHAR(100), -- lyria-v3-pro-rev2
  inference_time_ms INTEGER,
  
  -- AI Snapshot
  system_instructions_id VARCHAR(100),
  prompt_enhancement_enabled BOOLEAN DEFAULT FALSE,
  
  -- Raw Data (JSONB для гибкости)
  raw_data JSONB,
  conditions JSONB,
  lyrics_timestamped JSONB,
  
  -- Timestamps
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id),
  CONSTRAINT fk_parent FOREIGN KEY (parent_riff_id) REFERENCES tracks(id),
  CONSTRAINT fk_origin FOREIGN KEY (origin_id) REFERENCES tracks(id)
);

-- ============================================
-- RELATED TABLES
-- ============================================

-- СТЕМЫ (один-ко-многим)
CREATE TABLE stems (
  id SERIAL PRIMARY KEY,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  stem_type VARCHAR(50) NOT NULL, -- vocals, drums, bass, other
  stem_id UUID,
  download_url TEXT,
  file_hash VARCHAR(32),
  UNIQUE(track_id, stem_type)
);

-- ПРИМЕНЁННЫЕ FLOWS (макросы)
CREATE TABLE applied_flows (
  id SERIAL PRIMARY KEY,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  flow_name VARCHAR(200),
  flow_id UUID,
  version VARCHAR(50),
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ПРИМЕНЁННЫЕ MEMORIES
CREATE TABLE applied_memories (
  id SERIAL PRIMARY KEY,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  memory_text TEXT,
  memory_id UUID,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ВИДЕО МЕТАДАННЫЕ (детализация)
CREATE TABLE video_metadata (
  track_id UUID PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  aspect_ratio VARCHAR(20),
  motion_score REAL,
  style_reference_url TEXT,
  start_s REAL,
  end_s REAL,
  prompt TEXT,
  fps INTEGER,
  resolution VARCHAR(50),
  codec VARCHAR(50),
  bit_depth INTEGER,
  duration_s REAL
);

-- SPACES КОД (Vibe Coding)
CREATE TABLE spaces_code (
  track_id UUID PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  main_ts TEXT,
  shader_glsl TEXT,
  files JSONB,
  params JSONB,
  interactive_params JSONB
);

-- ПЛЕЙЛИСТЫ
CREATE TABLE playlists (
  id UUID PRIMARY KEY,
  name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  owner_id UUID
);

-- СВЯЗЬ ТРЕК-ПЛЕЙЛИСТ
CREATE TABLE track_playlists (
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (track_id, playlist_id)
);

-- ПОХОЖИЕ ТРЕКИ (рекомендации)
CREATE TABLE similar_tracks (
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  similar_track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  similarity_score REAL,
  PRIMARY KEY (track_id, similar_track_id)
);

-- PEAK MOMENTS (популярные сегменты)
CREATE TABLE peak_listener_segments (
  id SERIAL PRIMARY KEY,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  timestamp_s REAL,
  like_count INTEGER,
  replay_count INTEGER
);

-- INTERNAL TAGS (автоматически сгенерированные)
CREATE TABLE internal_tags (
  id SERIAL PRIMARY KEY,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  tag_category VARCHAR(100), -- mood, energy, genre
  tag_value VARCHAR(200), -- melancholic, high, electronic
  confidence REAL
);

-- СЕССИИ
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  ai_snapshot JSONB, -- полный снимок Instructions, Flows, Memories
  config JSONB
);

-- ПРОЕКТЫ
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  owner_id UUID
);

-- ============================================
-- INDEXES для производительности
-- ============================================
CREATE INDEX idx_tracks_created_at ON tracks(created_at);
CREATE INDEX idx_tracks_seed ON tracks(seed);
CREATE INDEX idx_tracks_parent ON tracks(parent_riff_id);
CREATE INDEX idx_tracks_origin ON tracks(origin_id);
CREATE INDEX idx_tracks_model ON tracks(model_name);
CREATE INDEX idx_tracks_privacy ON tracks(privacy_status);
CREATE INDEX idx_tracks_audio_md5 ON tracks(audio_md5);
CREATE INDEX idx_stems_track ON stems(track_id);
CREATE INDEX idx_flows_track ON applied_flows(track_id);
CREATE INDEX idx_memories_track ON applied_memories(track_id);

-- ============================================
-- VIEWS для удобных запросов
-- ============================================

-- Полная информация о треке
CREATE VIEW v_track_full AS
SELECT 
  t.*,
  array_agg(DISTINCT f.flow_name) FILTER (WHERE f.flow_name IS NOT NULL) as flows,
  array_agg(DISTINCT m.memory_text) FILTER (WHERE m.memory_text IS NOT NULL) as memories,
  COUNT(DISTINCT s.id) as stem_count
FROM tracks t
LEFT JOIN applied_flows f ON t.id = f.track_id
LEFT JOIN applied_memories m ON t.id = m.track_id
LEFT JOIN stems s ON t.id = s.track_id
GROUP BY t.id;

-- Генеалогия треков (дерево ремиксов)
CREATE VIEW v_lineage_tree AS
SELECT 
  t.id,
  t.title,
  t.origin_id,
  t.derivation_depth,
  t.branch_index,
  p.title as parent_title,
  o.title as origin_title,
  ARRAY(
    SELECT title FROM tracks 
    WHERE id = ANY(
      SELECT unnest(derivation_chain) 
      FROM tracks WHERE id = t.id
    )
  ) as lineage_titles
FROM tracks t
LEFT JOIN tracks p ON t.parent_riff_id = p.id
LEFT JOIN tracks o ON t.origin_id = o.id;
```

---

## 📦 **Полная MMSS JSON-структура**

```javascript
{
  "entry_id": "uuid-v4-of-the-record",
  
  "project_context": {
    "is_project": true,
    "project_id": "proj_987654321",
    "session_id": "sess_abc123xyz",
    "storage_tier": "active_archive"
  },
  
  "core_audio": {
    "id": "b3c0b9a2-30ee-40c6-982e-0806bd730152",
    "title": "Obsidian Tala",
    "seed": 632299520,
    "duration_s": 152.48,
    "created_at": "2026-05-30T19:46:04Z",
    
    "urls": {
      "stream": "https://...",
      "download_mp3": "https://.../audio.mp3",
      "download_wav": "https://.../audio.wav",
      "image_url": "https://.../cover.jpg"
    },
    
    "stems": {
      "is_stem_composite": true,
      "parent_clip_id": null,
      "stem_type": null, // если это отдельный stem
      "children_stems": [
        {"type": "vocals", "id": "uuid-v4", "url": "https://..."},
        {"type": "drums", "id": "uuid-v4", "url": "https://..."},
        {"type": "bass", "id": "uuid-v4", "url": "https://..."},
        {"type": "other", "id": "uuid-v4", "url": "https://..."}
      ]
    },
    
    "stats": {
      "play_count": 142,
      "favorite_count": 23,
      "share_count": 5
    }
  },
  
  "generation_logic": {
    "model_name": "Lyria 3 Pro",
    "mode": "standard", // standard | fast
    "ghostwriter_tier": "pro", // standard | pro
    "instrument": "Lyria 3 Pro",
    
    "prompt": {
      "user_input": "experimental Tala metal...",
      "negative_prompt": "lyrics, vocal",
      "strength": 0.85,
      "style_tags": ["metal", "experimental"]
    },
    
    "transform": {
      "type": "extend", // extend, remix, cover, replace, trim
      "is_remix": true,
      "remix_mode": "variation", // variation, cover, replace, extend, trim, use_prompt
      "parent_riff_id": "prev-uuid-v4",
      "parent_clip_id": "prev-uuid-v4",
      "offset_s": 30.0,
      "clip_start_s": 0.0,
      "clip_end_s": 60.0,
      "trim_start_s": null,
      "trim_end_s": null
    },
    
    "conditions": {},
    "lyrics_timestamped": [],
    "lyrics": null,
    "sound": null
  },
  
  "video_subsystem": {
    "has_video": true,
    "video_job_id": "job_cb9a13c0",
    "status": "completed",
    "video_url": "https://.../video.mp4",
    
    "metadata": {
      "aspect_ratio": "16:9",
      "motion_score": 0.75,
      "style_reference_url": "https://.../ref.jpg",
      "start_s": 0.0,
      "end_s": 30.0,
      "prompt": "cinematic metal visualizer",
      "fps": 30,
      "resolution": "1280x720"
    }
  },
  
  "ai_snapshot": {
    "memories_applied": ["user_prefers_microtonal", "no_drums_on_intro"],
    "system_instructions_id": "inst_001_v2",
    
    "applied_flows": [
      {"name": "hyperloop-v2", "id": "cb56f39a", "version": "2.1"}
    ],
    
    "metrics": {
      "coherence": 0.94,
      "stability": 0.98,
      "entropy_h": 0.42,
      "quality_score": 0.89
    },
    
    "config_snapshot": {
      "temperature": null,
      "top_p": null,
      "cfg_scale": 7.5,
      "sampling_steps": 50
    },
    
    "prompt_enhancement_enabled": true,
    "internal_tags": [
      {"category": "mood", "value": "melancholic", "confidence": 0.87},
      {"category": "energy", "value": "high", "confidence": 0.92}
    ]
  },
  
  "spaces_state": {
    "is_space": false,
    "space_id": null,
    
    "code_snapshot": {
      "main_ts": null,
      "shader_glsl": null,
      "files": {},
      "params": {}
    },
    
    "interactive_params": null
  },
  
  "analytics_and_meta": {
    "privacy": {
      "status": "unlisted", // public, unlisted, private
      "is_discoverable": false,
      "published_at": null
    },
    
    "technical_specs": {
      "audio_md5": "e99a18c428cb38d5f260853678922e03",
      "audio_codec": "mp3",
      "bitrate_kbps": 320,
      "sample_rate_hz": 48000,
      
      "video": {
        "codec": "h264",
        "fps": 30,
        "resolution": "1280x720",
        "bit_depth": 8
      }
    },
    
    "engagement_metrics": {
      "play_count": 142,
      "skip_count": 12,
      "skip_ratio": 0.084,
      "avg_completion_pct": 0.88,
      "completion_rate": 0.88,
      "is_favorited_by_me": true,
      "peak_listener_segments": [
        {"timestamp_s": 45.2, "like_count": 23, "replay_count": 12},
        {"timestamp_s": 92.7, "like_count": 18, "replay_count": 8}
      ]
    },
    
    "sampling_context": {
      "cfg_scale": 7.5,
      "sampling_steps": 50,
      "internal_model_id": "lyria-v3-pro-rev2",
      "inference_time_ms": 4500
    },
    
    "lineage": {
      "origin_id": "root-uuid",
      "derivation_chain": ["root-uuid", "remix1-uuid", "this-uuid"],
      "depth": 2,
      "branch_index": 3
    },
    
    "social": {
      "is_derivative": true,
      "source_user_id": "user-uuid",
      "original_track_id": "original-uuid",
      "in_playlists": ["playlist-uuid-1", "playlist-uuid-2"],
      "similar_tracks": [
        {"track_id": "similar-uuid-1", "similarity_score": 0.87},
        {"track_id": "similar-uuid-2", "similarity_score": 0.82}
      ]
    }
  },
  
  "metadata_expansion": {
    "prompt_strength": 0.85,
    "temporal_shift": null,
    
    "model_specific": {
      "lyria_version": "v3-pro-rev2",
      "model_hash": "abc123def456"
    },
    
    "is_public": false,
    "is_featured": false,
    "content_rating": null
  },
  
  "raw_data_anchor": {}, // Полный сырой объект для отладки
  
  "timestamps": {
    "archived_at": "2026-06-12T10:30:00Z",
    "last_synced": "2026-06-12T10:30:00Z"
  }
}
```

---

## 🚀 **Шаги реализации**

### **Этап 1: Подготовка PostgreSQL (30 мин)**

```bash
# 1.1. Создать новую БД
createdb abstract-mind-lab - (готово - бд создана)

# 1.2. Применить схему
psql -d abstract-mind-lab -f schema.sql - не готово

# 1.3. Проверить создание таблиц
psql -d abstract-mind-lab -c "\dt"
```

### **Этап 2: Обновление конфигурации (15 мин)**

```javascript
// 2.1. Обновить .env
DB_MODE=v2
DB_NAME_V2=abstract-mind-lab
DB_PASSWORD=mindfreak

// 2.2. Обновить config.js
// Добавить переключение БД (см. выше)
```

### **Этап 3: Рефакторинг парсера (2-3 часа)**

```javascript
// 3.1. Создать новый файл mmss-mapper.js
// Перенести функцию mapTrackToMMSS() из этого TASK.md

// 3.2. Создать helper-методы
// - extractStems()
// - extractFlows()
// - detectRemixMode()
// - buildRelationGraph()
// - enrichLineage()

// 3.3. Обновить archiver.mjs
// - Изменить порядок парсинга (4 фазы)
// - Интегрировать MMSS-маппинг
// - Добавить сохранение в PostgreSQL

// 3.4. Создать postgres-client.js
// - Подключение к БД
// - Методы saveTrack(), saveStems(), saveFlows()
// - Транзакции для целостности данных
```

### **Этап 4: Интеграция дополнительных метаданных (1-2 часа)**

```javascript
// 4.1. Добавить fetchAISnapshot()
// - Запрос к /sessions/{id}/config
// - Сохранение Instructions, Flows, Memories

// 4.2. Добавить fetchVideoJobs()
// - Получение видео-джоб
// - Привязка к трекам через video_job_id

// 4.3. Добавить lineage calculation
// - Построение дерева ремиксов
// - Вычисление derivation_depth, origin_id, branch_index

// 4.4. Добавить engagement metrics
// - skip_ratio, completion_rate, peak_listener_segments
```

### **Этап 5: Интеграция со скриптом встраивания метаданных (30 мин)**

```javascript
// 5.1. Вызов существующего скрипта после скачивания
for (const entry of mmssEntries) {
  await embedMetadata(entry); // Вызов embed-metadata.sh или аналога
}

// 5.2. Проверка успешности встраивания
// - Логирование результатов
// - Обработка ошибок
```

### **Этап 6: Тестирование (1-2 часа)**

```javascript
// 6.1. Unit-тесты для MMSS-маппинга
// - Проверка всех полей
// - Проверка fallback-значений

// 6.2. Интеграционные тесты
// - Полный цикл парсинга
// - Проверка сохранения в PostgreSQL
// - Проверка встраивания метаданных

// 6.3. Нагрузочное тестирование
// - Парсинг 100+ треков
// - Проверка производительности
// - Проверка дедупликации по audio_md5
```

### **Этап 7: Миграция данных (опционально, 1 час)**

```javascript
// 7.1. Экспорт данных из v1 БД
const legacyData = await exportFromV1();

// 7.2. Трансформация в MMSS-формат
const mmssData = legacyData.map(transformLegacyToMMSS);

// 7.3. Импорт в v2 БД
await importToV2(mmssData);
```

### **Этап 8: Документация и финализация (30 мин)**

```markdown
// 8.1. Обновить README.md
// - Описание новой архитектуры
// - Инструкция по переключению БД
// - Описание MMSS-структуры

// 8.2. Создать CHANGELOG.md
// - Список изменений
// - Breaking changes
// - Migration guide

// 8.3. Создать API.md
// - Описание всех методов
// - Примеры использования
```

---

## 🧪 **План тестирования**

### **Unit-тесты**

```javascript
// test/mmss-mapper.test.js
describe('MMSS Mapper', () => {
  test('should map basic track data', () => {
    const track = { id: 'test-id', title: 'Test Track', seed: 12345 };
    const result = mapTrackToMMSS(track);
    expect(result.core_audio.id).toBe('test-id');
    expect(result.core_audio.seed).toBe(12345);
  });
  
  test('should handle missing fields gracefully', () => {
    const track = { id: 'test-id' };
    const result = mapTrackToMMSS(track);
    expect(result.core_audio.title).toBe('Track_test-id');
    expect(result.core_audio.seed).toBeNull();
  });
  
  test('should extract stems correctly', () => {
    const track = {
      id: 'test-id',
      stems: [
        { type: 'vocals', id: 'stem-1', url: 'https://...' }
      ]
    };
    const result = mapTrackToMMSS(track);
    expect(result.core_audio.stems.children_stems).toHaveLength(1);
    expect(result.core_audio.stems.children_stems[0].type).toBe('vocals');
  });
});
```

### **Интеграционные тесты**

```javascript
// test/integration.test.js
describe('Full Pipeline', () => {
  test('should parse and save track to PostgreSQL', async () => {
    const trackId = 'test-track-id';
    await runFullPipeline(trackId);
    
    const saved = await db.query('SELECT * FROM tracks WHERE id = $1', [trackId]);
    expect(saved.rows).toHaveLength(1);
    expect(saved.rows[0].title).toBeTruthy();
  });
  
  test('should handle remix lineage', async () => {
    const parentTrack = await createTestTrack();
    const remixTrack = await createRemixTrack(parentTrack.id);
    
    await runFullPipeline(remixTrack.id);
    
    const saved = await db.query('SELECT * FROM tracks WHERE id = $1', [remixTrack.id]);
    expect(saved.rows[0].parent_riff_id).toBe(parentTrack.id);
    expect(saved.rows[0].derivation_depth).toBe(1);
  });
});
```

---

## ⚠️ **Риски и откат**

### **Риски**

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Потеря данных при миграции | Средняя | Высокое | Бэкап v1 БД перед миграцией |
| Неправильный маппинг полей | Высокая | Среднее | Тщательное тестирование, raw_data_anchor |
| Проблемы с производительностью | Низкая | Среднее | Индексы в PostgreSQL, батчинг |
| Конфликт с существующим кодом | Средняя | Высокое | Git branches, feature flags |

### **План отката**

```bash
# 1. Переключить обратно на v1 БД
DB_MODE=v1

# 2. Откатить код через Git
git checkout main
git revert <commit-hash>

# 3. Восстановить данные из бэкапа (если нужно)
pg_restore -d flowmusic_archive backup_v1.sql
```

---

## 📚 **Дополнительные ресурсы**

### **Ссылки на код**
- Main file: https://github.com/Abstract-Mindfreak/extract/raw/refs/heads/main/flowmusic-archiver/archiver.mjs
- Tool directory: https://github.com/Abstract-Mindfreak/extract/tree/cf202e2a09739f3d0029d221a34501c1fdc87e68/flowmusic-archiver
- Main branch: https://github.com/Abstract-Mindfreak/extract/tree/main

### **Документация API Flow Music**
- Ω-Protocol v2.0 (внутренняя документация)
- MMSS Library Standards
- API Response Examples (см. предыдущие ответы от flowmusic.app)

### **Контакты**
- Devin (Codex Chat GPT 5.4) — основной инструмент разработки
- Qwen — консультант по архитектуре и MMSS-протоколу
- Flow Music AI — источник информации о структуре API

---

## 🎯 **Критерии успеха**

### **Функциональные**
- ✅ Все треки парсятся в MMSS-формате
- ✅ Граф связей построен корректно (parent-child, stems, video)
- ✅ AI snapshot сохраняется для каждой сессии
- ✅ Lineage вычисляется правильно (derivation_depth, origin_id)
- ✅ Метаданные встраиваются в аудиофайлы

### **Технические**
- ✅ Переключение БД работает (v1 ↔ v2)
- ✅ PostgreSQL схема создана и заполняется
- ✅ Дедупликация по audio_md5 работает
- ✅ Производительность: 100 треков < 5 минут
- ✅ Нет потери данных при откате

### **Качественные**
- ✅ Код покрыт тестами (>80%)
- ✅ Документация обновлена
- ✅ README содержит инструкцию по использованию
- ✅ CHANGELOG описывает все изменения

---

## 🏁 **Финальная проверка**

Перед запуском в продакшен:

```bash
# 1. Проверить конфигурацию
cat .env | grep DB_

# 2. Проверить подключение к БД
psql -d abstract-mind-lab -c "SELECT COUNT(*) FROM tracks;"

# 3. Запустить тестовый парсинг (1 трек)
node archiver.mjs --test --track-id=test-id

# 4. Проверить результат
psql -d abstract-mind-lab -c "SELECT * FROM v_track_full WHERE id='test-id';"

# 5. Если всё ок — запуск полного парсинга
node archiver.mjs --mode=full
```

---

