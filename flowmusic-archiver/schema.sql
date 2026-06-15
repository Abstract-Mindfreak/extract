CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID,
  project_id UUID,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ai_snapshot JSONB DEFAULT '{}'::jsonb,
  config JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY,
  entry_id UUID UNIQUE NOT NULL,
  title TEXT,
  seed BIGINT,
  duration_s REAL,
  created_at TIMESTAMPTZ,
  stream_url TEXT,
  mp3_url TEXT,
  wav_url TEXT,
  image_url TEXT,
  is_project BOOLEAN DEFAULT FALSE,
  project_id UUID,
  session_id UUID,
  storage_tier VARCHAR(50) DEFAULT 'active_archive',
  model_name VARCHAR(100),
  generation_mode VARCHAR(50),
  ghostwriter_tier VARCHAR(50),
  instrument VARCHAR(100),
  prompt TEXT,
  negative_prompt TEXT,
  prompt_strength REAL,
  transform_type VARCHAR(50),
  remix_mode VARCHAR(50),
  parent_riff_id UUID,
  parent_clip_id UUID,
  offset_s REAL,
  clip_start_s REAL,
  clip_end_s REAL,
  trim_start_s REAL,
  trim_end_s REAL,
  has_video BOOLEAN DEFAULT FALSE,
  video_job_id TEXT,
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
  is_stem_composite BOOLEAN DEFAULT FALSE,
  stem_type VARCHAR(50),
  is_space BOOLEAN DEFAULT FALSE,
  space_id UUID,
  privacy_status VARCHAR(50),
  is_discoverable BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  is_derivative BOOLEAN DEFAULT FALSE,
  source_user_id UUID,
  original_track_id UUID,
  play_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  skip_count INTEGER DEFAULT 0,
  skip_ratio REAL,
  completion_rate REAL,
  avg_completion_pct REAL,
  is_favorited_by_me BOOLEAN DEFAULT FALSE,
  origin_id UUID,
  derivation_depth INTEGER DEFAULT 0,
  branch_index INTEGER DEFAULT 0,
  audio_md5 VARCHAR(32),
  audio_codec VARCHAR(50),
  bitrate_kbps INTEGER,
  sample_rate_hz INTEGER,
  cfg_scale REAL,
  sampling_steps INTEGER,
  internal_model_id VARCHAR(100),
  inference_time_ms INTEGER,
  system_instructions_id VARCHAR(100),
  prompt_enhancement_enabled BOOLEAN,
  raw_data JSONB DEFAULT '{}'::jsonb,
  conditions JSONB DEFAULT '{}'::jsonb,
  lyrics_timestamped JSONB DEFAULT '[]'::jsonb,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stems (
  id BIGSERIAL PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  stem_type VARCHAR(50) NOT NULL,
  stem_id UUID,
  download_url TEXT,
  file_hash VARCHAR(32),
  UNIQUE (track_id, stem_type)
);

CREATE TABLE IF NOT EXISTS applied_flows (
  id BIGSERIAL PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  flow_name VARCHAR(200),
  flow_id UUID,
  version VARCHAR(50),
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applied_memories (
  id BIGSERIAL PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  memory_text TEXT,
  memory_id UUID,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_metadata (
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

CREATE TABLE IF NOT EXISTS internal_tags (
  id BIGSERIAL PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tag_category VARCHAR(100),
  tag_value VARCHAR(200),
  confidence REAL
);

CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at);
CREATE INDEX IF NOT EXISTS idx_tracks_parent_riff_id ON tracks(parent_riff_id);
CREATE INDEX IF NOT EXISTS idx_tracks_origin_id ON tracks(origin_id);
CREATE INDEX IF NOT EXISTS idx_tracks_session_id ON tracks(session_id);
CREATE INDEX IF NOT EXISTS idx_tracks_audio_md5 ON tracks(audio_md5);
CREATE INDEX IF NOT EXISTS idx_tracks_model_name ON tracks(model_name);
CREATE INDEX IF NOT EXISTS idx_stems_track_id ON stems(track_id);
CREATE INDEX IF NOT EXISTS idx_applied_flows_track_id ON applied_flows(track_id);
CREATE INDEX IF NOT EXISTS idx_applied_memories_track_id ON applied_memories(track_id);
