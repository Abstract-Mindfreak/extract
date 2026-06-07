-- Создание индекса инвертированного типа (GIN) для ускорения вложенного поиска по ключам JSONB
CREATE INDEX IF NOT EXISTS idx_songs_raw_data_gin ON songs USING gin (raw_data);

-- Создание композитного индекса для ускорения сортировки и пагинации связки счетчиков прослушиваний
CREATE INDEX IF NOT EXISTS idx_songs_metrics ON songs (play_count DESC, favorite_count DESC);

-- Индекс для текстового поиска по извлеченным звуковым промптам
CREATE INDEX IF NOT EXISTS idx_songs_sound_prompt_trgm ON songs USING gin (sound_prompt gin_trgm_ops);
