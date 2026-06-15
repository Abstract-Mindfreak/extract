import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

export class PostgresArchiveClient {
  constructor({ connectionString, autoInit = true, schemaPath }) {
    this.pool = new Pool({ connectionString });
    this.autoInit = autoInit;
    this.schemaPath = schemaPath;
    this.initialized = false;
  }

  async close() {
    await this.pool.end();
  }

  async ensureSchema() {
    if (this.initialized || !this.autoInit) return;
    const sql = await fs.readFile(this.schemaPath, 'utf8');
    await this.pool.query(sql);
    this.initialized = true;
  }

  async saveArchive({ sessions, entries }) {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const session of sessions) {
        await this.saveSession(client, session);
      }
      for (const entry of entries) {
        await this.saveTrackBundle(client, entry);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async saveSession(client, session) {
    await client.query(
      `
        INSERT INTO sessions (id, user_id, project_id, title, created_at, updated_at, ai_snapshot, config)
        VALUES ($1::uuid, NULLIF($2, '')::uuid, NULLIF($3, '')::uuid, $4, COALESCE($5::timestamptz, NOW()), NOW(), $6::jsonb, $7::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          project_id = EXCLUDED.project_id,
          title = EXCLUDED.title,
          updated_at = NOW(),
          ai_snapshot = EXCLUDED.ai_snapshot,
          config = EXCLUDED.config
      `,
      [
        session.session_id,
        session.user_id,
        session.project_id,
        session.title,
        null,
        JSON.stringify(session),
        JSON.stringify(session.config_snapshot ?? {}),
      ],
    );
  }

  async saveTrackBundle(client, entry) {
    const core = entry.core_audio ?? {};
    const project = entry.project_context ?? {};
    const logic = entry.generation_logic ?? {};
    const transform = logic.transform ?? {};
    const video = entry.video_subsystem ?? {};
    const videoMeta = video.metadata ?? {};
    const analytics = entry.analytics_and_meta ?? {};
    const privacy = analytics.privacy ?? {};
    const technical = analytics.technical_specs ?? {};
    const engagement = analytics.engagement_metrics ?? {};
    const sampling = analytics.sampling_context ?? {};
    const lineage = analytics.lineage ?? {};
    const social = analytics.social ?? {};
    const snapshot = entry.ai_snapshot ?? {};

    await client.query(
      `
        INSERT INTO tracks (
          id, entry_id, title, seed, duration_s, created_at, stream_url, mp3_url, wav_url, image_url,
          is_project, project_id, session_id, storage_tier, model_name, generation_mode, ghostwriter_tier,
          instrument, prompt, negative_prompt, prompt_strength, transform_type, remix_mode, parent_riff_id,
          parent_clip_id, offset_s, clip_start_s, clip_end_s, trim_start_s, trim_end_s, has_video, video_job_id,
          video_status, video_url, video_aspect_ratio, video_motion_score, video_style_ref_url, video_start_s,
          video_end_s, video_prompt, video_fps, video_resolution, is_stem_composite, stem_type, is_space,
          space_id, privacy_status, is_discoverable, published_at, is_derivative, source_user_id,
          original_track_id, play_count, favorite_count, share_count, skip_count, skip_ratio, completion_rate,
          avg_completion_pct, is_favorited_by_me, origin_id, derivation_depth, branch_index, audio_md5,
          audio_codec, bitrate_kbps, sample_rate_hz, cfg_scale, sampling_steps, internal_model_id,
          inference_time_ms, system_instructions_id, prompt_enhancement_enabled, raw_data, conditions,
          lyrics_timestamped, archived_at, last_synced
        )
        VALUES (
          $1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10,
          $11, NULLIF($12, '')::uuid, NULLIF($13, '')::uuid, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23, NULLIF($24, '')::uuid,
          NULLIF($25, '')::uuid, $26, $27, $28, $29, $30, $31, $32,
          $33, $34, $35, $36, $37, $38,
          $39, $40, $41, $42, $43, $44, $45,
          NULLIF($46, '')::uuid, $47, $48, $49::timestamptz, $50, NULLIF($51, '')::uuid,
          NULLIF($52, '')::uuid, $53, $54, $55, $56, $57, $58,
          $59, $60, NULLIF($61, '')::uuid, $62, $63, $64,
          $65, $66, $67, $68, $69, $70,
          $71, $72, $73, $74::jsonb, $75::jsonb,
          $76::jsonb, $77::timestamptz, $78::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          seed = EXCLUDED.seed,
          duration_s = EXCLUDED.duration_s,
          created_at = EXCLUDED.created_at,
          stream_url = EXCLUDED.stream_url,
          mp3_url = EXCLUDED.mp3_url,
          wav_url = EXCLUDED.wav_url,
          image_url = EXCLUDED.image_url,
          is_project = EXCLUDED.is_project,
          project_id = EXCLUDED.project_id,
          session_id = EXCLUDED.session_id,
          storage_tier = EXCLUDED.storage_tier,
          model_name = EXCLUDED.model_name,
          generation_mode = EXCLUDED.generation_mode,
          ghostwriter_tier = EXCLUDED.ghostwriter_tier,
          instrument = EXCLUDED.instrument,
          prompt = EXCLUDED.prompt,
          negative_prompt = EXCLUDED.negative_prompt,
          prompt_strength = EXCLUDED.prompt_strength,
          transform_type = EXCLUDED.transform_type,
          remix_mode = EXCLUDED.remix_mode,
          parent_riff_id = EXCLUDED.parent_riff_id,
          parent_clip_id = EXCLUDED.parent_clip_id,
          offset_s = EXCLUDED.offset_s,
          clip_start_s = EXCLUDED.clip_start_s,
          clip_end_s = EXCLUDED.clip_end_s,
          trim_start_s = EXCLUDED.trim_start_s,
          trim_end_s = EXCLUDED.trim_end_s,
          has_video = EXCLUDED.has_video,
          video_job_id = EXCLUDED.video_job_id,
          video_status = EXCLUDED.video_status,
          video_url = EXCLUDED.video_url,
          video_aspect_ratio = EXCLUDED.video_aspect_ratio,
          video_motion_score = EXCLUDED.video_motion_score,
          video_style_ref_url = EXCLUDED.video_style_ref_url,
          video_start_s = EXCLUDED.video_start_s,
          video_end_s = EXCLUDED.video_end_s,
          video_prompt = EXCLUDED.video_prompt,
          video_fps = EXCLUDED.video_fps,
          video_resolution = EXCLUDED.video_resolution,
          is_stem_composite = EXCLUDED.is_stem_composite,
          stem_type = EXCLUDED.stem_type,
          is_space = EXCLUDED.is_space,
          space_id = EXCLUDED.space_id,
          privacy_status = EXCLUDED.privacy_status,
          is_discoverable = EXCLUDED.is_discoverable,
          published_at = EXCLUDED.published_at,
          is_derivative = EXCLUDED.is_derivative,
          source_user_id = EXCLUDED.source_user_id,
          original_track_id = EXCLUDED.original_track_id,
          play_count = EXCLUDED.play_count,
          favorite_count = EXCLUDED.favorite_count,
          share_count = EXCLUDED.share_count,
          skip_count = EXCLUDED.skip_count,
          skip_ratio = EXCLUDED.skip_ratio,
          completion_rate = EXCLUDED.completion_rate,
          avg_completion_pct = EXCLUDED.avg_completion_pct,
          is_favorited_by_me = EXCLUDED.is_favorited_by_me,
          origin_id = EXCLUDED.origin_id,
          derivation_depth = EXCLUDED.derivation_depth,
          branch_index = EXCLUDED.branch_index,
          audio_md5 = EXCLUDED.audio_md5,
          audio_codec = EXCLUDED.audio_codec,
          bitrate_kbps = EXCLUDED.bitrate_kbps,
          sample_rate_hz = EXCLUDED.sample_rate_hz,
          cfg_scale = EXCLUDED.cfg_scale,
          sampling_steps = EXCLUDED.sampling_steps,
          internal_model_id = EXCLUDED.internal_model_id,
          inference_time_ms = EXCLUDED.inference_time_ms,
          system_instructions_id = EXCLUDED.system_instructions_id,
          prompt_enhancement_enabled = EXCLUDED.prompt_enhancement_enabled,
          raw_data = EXCLUDED.raw_data,
          conditions = EXCLUDED.conditions,
          lyrics_timestamped = EXCLUDED.lyrics_timestamped,
          last_synced = EXCLUDED.last_synced
      `,
      [
        core.id,
        entry.entry_id,
        core.title,
        core.seed,
        core.duration_s,
        core.created_at,
        core.urls?.stream_url ?? null,
        core.urls?.download_mp3 ?? null,
        core.urls?.wav_url ?? null,
        core.urls?.image_url ?? null,
        project.is_project ?? false,
        project.project_id,
        project.session_id,
        project.storage_tier ?? 'active_archive',
        logic.model_name ?? null,
        logic.mode ?? null,
        logic.ghostwriter_tier ?? null,
        logic.instrument ?? null,
        logic.prompt?.user_input ?? null,
        logic.prompt?.negative_prompt ?? null,
        logic.prompt?.strength ?? null,
        transform.type ?? null,
        transform.remix_mode ?? null,
        transform.parent_riff_id ?? null,
        transform.parent_clip_id ?? null,
        transform.offset_s ?? null,
        transform.clip_start_s ?? null,
        transform.clip_end_s ?? null,
        transform.trim_start_s ?? null,
        transform.trim_end_s ?? null,
        video.has_video ?? false,
        video.video_job_id ?? null,
        video.status ?? null,
        video.video_url ?? null,
        videoMeta.aspect_ratio ?? null,
        videoMeta.motion_score ?? null,
        videoMeta.style_reference_url ?? null,
        videoMeta.start_s ?? null,
        videoMeta.end_s ?? null,
        videoMeta.prompt ?? null,
        videoMeta.fps ?? null,
        videoMeta.resolution ?? null,
        core.stems?.is_stem_composite ?? false,
        core.stems?.stem_type ?? null,
        entry.spaces_state?.is_space ?? false,
        entry.spaces_state?.space_id ?? null,
        privacy.status ?? 'private',
        privacy.is_discoverable ?? false,
        privacy.published_at ?? null,
        social.is_derivative ?? false,
        social.source_user_id ?? null,
        social.original_track_id ?? null,
        core.stats?.play_count ?? 0,
        core.stats?.favorite_count ?? 0,
        core.stats?.share_count ?? 0,
        engagement.skip_count ?? 0,
        engagement.skip_ratio ?? null,
        engagement.completion_rate ?? null,
        engagement.avg_completion_pct ?? null,
        engagement.is_favorited_by_me ?? false,
        lineage.origin_id ?? core.id,
        lineage.depth ?? 0,
        lineage.branch_index ?? 0,
        technical.audio_md5 ?? null,
        technical.audio_codec ?? null,
        technical.bitrate_kbps ?? null,
        technical.sample_rate_hz ?? null,
        sampling.cfg_scale ?? null,
        sampling.sampling_steps ?? null,
        sampling.internal_model_id ?? null,
        sampling.inference_time_ms ?? null,
        snapshot.system_instructions_id ?? null,
        snapshot.prompt_enhancement_enabled ?? null,
        JSON.stringify(entry.raw_data_anchor ?? {}),
        JSON.stringify(logic.conditions ?? {}),
        JSON.stringify(logic.lyrics_timestamped ?? []),
        entry.timestamps?.archived_at ?? new Date().toISOString(),
        entry.timestamps?.last_synced ?? new Date().toISOString(),
      ],
    );

    await client.query('DELETE FROM stems WHERE track_id = $1::uuid', [core.id]);
    for (const stem of core.stems?.children_stems ?? []) {
      await client.query(
        `
          INSERT INTO stems (track_id, stem_type, stem_id, download_url, file_hash)
          VALUES ($1::uuid, $2, NULLIF($3, '')::uuid, $4, NULL)
          ON CONFLICT (track_id, stem_type) DO UPDATE SET
            stem_id = EXCLUDED.stem_id,
            download_url = EXCLUDED.download_url
        `,
        [core.id, stem.type ?? 'other', stem.id ?? null, stem.url ?? null],
      );
    }

    await client.query('DELETE FROM applied_flows WHERE track_id = $1::uuid', [core.id]);
    for (const flow of snapshot.applied_flows ?? []) {
      await client.query(
        `
          INSERT INTO applied_flows (track_id, flow_name, flow_id, version)
          VALUES ($1::uuid, $2, NULLIF($3, '')::uuid, $4)
        `,
        [core.id, flow.name ?? null, flow.id ?? null, flow.version ?? null],
      );
    }

    await client.query('DELETE FROM applied_memories WHERE track_id = $1::uuid', [core.id]);
    for (const memoryText of snapshot.memories_applied ?? []) {
      await client.query(
        `
          INSERT INTO applied_memories (track_id, memory_text, memory_id)
          VALUES ($1::uuid, $2, NULL)
        `,
        [core.id, memoryText],
      );
    }

    await client.query(
      `
        INSERT INTO video_metadata (
          track_id, aspect_ratio, motion_score, style_reference_url, start_s, end_s,
          prompt, fps, resolution, codec, bit_depth, duration_s
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (track_id) DO UPDATE SET
          aspect_ratio = EXCLUDED.aspect_ratio,
          motion_score = EXCLUDED.motion_score,
          style_reference_url = EXCLUDED.style_reference_url,
          start_s = EXCLUDED.start_s,
          end_s = EXCLUDED.end_s,
          prompt = EXCLUDED.prompt,
          fps = EXCLUDED.fps,
          resolution = EXCLUDED.resolution,
          codec = EXCLUDED.codec,
          bit_depth = EXCLUDED.bit_depth,
          duration_s = EXCLUDED.duration_s
      `,
      [
        core.id,
        videoMeta.aspect_ratio ?? null,
        videoMeta.motion_score ?? null,
        videoMeta.style_reference_url ?? null,
        videoMeta.start_s ?? null,
        videoMeta.end_s ?? null,
        videoMeta.prompt ?? null,
        videoMeta.fps ?? null,
        videoMeta.resolution ?? null,
        technical.video?.codec ?? null,
        technical.video?.bit_depth ?? null,
        core.duration_s ?? null,
      ],
    );

    await client.query('DELETE FROM internal_tags WHERE track_id = $1::uuid', [core.id]);
    for (const tag of snapshot.internal_tags ?? []) {
      await client.query(
        `
          INSERT INTO internal_tags (track_id, tag_category, tag_value, confidence)
          VALUES ($1::uuid, $2, $3, $4)
        `,
        [core.id, tag.category ?? null, tag.value ?? null, tag.confidence ?? null],
      );
    }
  }
}

export function defaultSchemaPath() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'schema.sql');
}
