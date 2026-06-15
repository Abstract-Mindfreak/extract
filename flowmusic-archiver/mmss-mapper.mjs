function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function compactObject(value) {
  if (!value || typeof value !== 'object') return {};
  return value;
}

function extractPromptText(track) {
  return (
    track?.sound?.prompt ??
    track?.sound?.text ??
    track?.raw_data?.operation?.sound_prompt ??
    track?.raw_data?.operation?.prompt ??
    track?.conditions?.prompt ??
    null
  );
}

function extractNegativePrompt(track) {
  return (
    track?.conditions?.negative_prompt ??
    track?.raw_data?.operation?.negative_prompt ??
    null
  );
}

function extractPromptStrength(track) {
  const candidates = [
    track?.conditions?.prompt_strength,
    track?.conditions?.strength,
    track?.raw_data?.operation?.prompt_strength,
    track?.raw_data?.operation?.strength,
  ];
  return candidates.find((value) => typeof value === 'number') ?? null;
}

function extractConditions(track) {
  const source =
    track?.conditions ??
    track?.raw_data?.conditions ??
    track?.raw_data?.operation?.conditions ??
    null;

  if (source && typeof source === 'object' && !Array.isArray(source)) {
    return source;
  }

  const prompt = extractPromptText(track);
  const negativePrompt = extractNegativePrompt(track);
  const promptStrength = extractPromptStrength(track);

  return compactObject({
    ...(prompt ? { prompt } : {}),
    ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
    ...(promptStrength != null ? { prompt_strength: promptStrength } : {}),
  });
}

function extractTransformValue(track, ...keys) {
  const sources = [
    track,
    track?.raw_data,
    track?.raw_data?.operation,
  ];

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of keys) {
      if (source[key] != null) return source[key];
    }
  }

  return null;
}

function parseFlowTokens(payload) {
  const seen = new Set();
  const flows = [];
  const textChunks = [];

  for (const message of safeArray(payload?.messages)) {
    for (const part of safeArray(message?.parts)) {
      if (typeof part?.content === 'string') textChunks.push(part.content);
      if (typeof part?.tool_name === 'string' && part.tool_name.includes('flow')) {
        textChunks.push(part.tool_name);
      }
    }
  }

  const matches = textChunks.join('\n').match(/\/[a-z0-9_-]+/gi) ?? [];
  for (const match of matches) {
    const normalized = match.slice(1).toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    flows.push({
      id: null,
      name: normalized,
      version: null,
    });
  }

  return flows;
}

function buildSessionSnapshot(sessionRecord) {
  if (!sessionRecord?.payload) return null;
  const payload = sessionRecord.payload;
  const memories = [];
  const memorySeen = new Set();

  for (const message of safeArray(payload.messages)) {
    for (const part of safeArray(message?.parts)) {
      if (typeof part?.content !== 'string') continue;
      const text = part.content.trim();
      if (!text || text.length < 16 || text.length > 240) continue;
      if (memorySeen.has(text)) continue;
      memorySeen.add(text);
      memories.push(text);
      if (memories.length >= 8) break;
    }
    if (memories.length >= 8) break;
  }

  return {
    session_id: sessionRecord.conversation_id ?? payload.id ?? null,
    title: payload.title ?? null,
    user_id: payload.user_id ?? null,
    project_id: payload.project_id ?? null,
    instructions: safeArray(payload.messages)
      .flatMap((message) => safeArray(message.parts))
      .map((part) => part?.instructions)
      .find(Boolean) ?? null,
    memories_applied: memories,
    applied_flows: parseFlowTokens(payload),
    video_job_ids: safeArray(sessionRecord.linked?.linked_video_job_ids),
    config_snapshot: {
      message_count: safeArray(payload.messages).length,
    },
    prompt_enhancement_enabled: null,
    payload,
  };
}

export function extractStems(track) {
  const stems = [];
  const sources = [
    ...safeArray(track?.stems),
    ...safeArray(track?.raw_data?.stems),
    ...safeArray(track?.raw_data?.stem_children),
  ];

  for (const stem of sources) {
    if (!stem || typeof stem !== 'object') continue;
    stems.push({
      type: stem.type ?? stem.stem_type ?? 'other',
      id: stem.id ?? stem.stem_id ?? null,
      url: stem.url ?? stem.download_url ?? stem.audio_url ?? null,
    });
  }

  return stems;
}

export function detectRemixMode(track) {
  const transformType = extractTransformValue(track, 'transform_type', 'transform');

  if (!transformType) return null;
  const normalized = String(transformType).toLowerCase();
  if (normalized.includes('variation')) return 'variation';
  if (normalized.includes('cover')) return 'cover';
  if (normalized.includes('replace')) return 'replace';
  if (normalized.includes('extend')) return 'extend';
  if (normalized.includes('trim')) return 'trim';
  return normalized;
}

export function buildRelationGraph(tracks) {
  const graph = {
    nodes: new Map(),
    childrenByParent: new Map(),
    sessionByTrack: new Map(),
    trackByOperationId: new Map(),
    stemChildrenByTrack: new Map(),
  };

  for (const track of tracks) {
    graph.nodes.set(track.id, track);
    if (track.session_id) graph.sessionByTrack.set(track.id, track.session_id);

    const operationIds = [
      track?.raw_data?.operation_id,
      track?.raw_data?.operation?.id,
      track?.raw_data?.operation?.operation_id,
    ].filter(Boolean);
    for (const operationId of operationIds) {
      graph.trackByOperationId.set(operationId, track.id);
    }

    const parentId =
      extractTransformValue(track, 'parent_id', 'parent_riff_id');
    if (parentId) {
      const children = graph.childrenByParent.get(parentId) ?? [];
      children.push(track.id);
      graph.childrenByParent.set(parentId, children);
    }

    const stems = extractStems(track);
    if (stems.length) {
      graph.stemChildrenByTrack.set(track.id, stems);
    }
  }

  return graph;
}

function computeLineage(trackId, graph, cache, stack = new Set()) {
  if (!trackId || !graph.nodes.has(trackId)) {
    return { origin_id: trackId ?? null, depth: 0, branch_index: 0, chain: trackId ? [trackId] : [] };
  }
  if (cache.has(trackId)) return cache.get(trackId);
  if (stack.has(trackId)) {
    return { origin_id: trackId, depth: 0, branch_index: 0, chain: [trackId] };
  }

  stack.add(trackId);
  const track = graph.nodes.get(trackId);
  const parentId =
    extractTransformValue(track, 'parent_id', 'parent_riff_id');

  if (!parentId || !graph.nodes.has(parentId)) {
    const base = { origin_id: trackId, depth: 0, branch_index: 0, chain: [trackId] };
    cache.set(trackId, base);
    stack.delete(trackId);
    return base;
  }

  const parentLineage = computeLineage(parentId, graph, cache, stack);
  const siblings = graph.childrenByParent.get(parentId) ?? [];
  const branchIndex = Math.max(siblings.indexOf(trackId), 0) + 1;
  const lineage = {
    origin_id: parentLineage.origin_id ?? parentId,
    depth: (parentLineage.depth ?? 0) + 1,
    branch_index: branchIndex,
    chain: [...safeArray(parentLineage.chain), trackId],
  };
  cache.set(trackId, lineage);
  stack.delete(trackId);
  return lineage;
}

export function enrichLineage(tracks, graph) {
  const cache = new Map();
  return tracks.map((track) => {
    const lineage = computeLineage(track.id, graph, cache);
    return {
      ...track,
      lineage,
      origin_id: lineage.origin_id,
      derivation_depth: lineage.depth,
      branch_index: lineage.branch_index,
    };
  });
}

export function mapTrackToMMSS(track, context = {}) {
  const sessionSnapshot = context.sessionSnapshots?.get(track.session_id) ?? null;
  const linkedVideoJobIds = safeArray(context.videoJobsByTrackId?.get(track.id));
  const stems = extractStems(track);
  const prompt = extractPromptText(track);
  const negativePrompt = extractNegativePrompt(track);
  const promptStrength = extractPromptStrength(track);
  const flowList = sessionSnapshot?.applied_flows ?? [];
  const sessionVideoJobIds = safeArray(sessionSnapshot?.video_job_ids);
  const memories = safeArray(sessionSnapshot?.memories_applied).map((memoryText, index) => ({
    id: null,
    text: memoryText,
    index,
  }));

  return {
    entry_id: track.id,
    project_context: {
      is_project: Boolean(track?.raw_data?.project_id ?? sessionSnapshot?.project_id),
      project_id: track?.raw_data?.project_id ?? sessionSnapshot?.project_id ?? null,
      session_id: track.session_id ?? null,
      storage_tier: 'active_archive',
    },
    core_audio: {
      id: track.id,
      title: track.title ?? `Track_${String(track.id).slice(0, 8)}`,
      seed: track.seed ?? null,
      duration_s: track.duration ?? track.duration_s ?? null,
      created_at: track.created_at ?? null,
      urls: {
        stream_url: track.audio_url ?? null,
        download_mp3: track.audio_url ?? null,
        wav_url: track.wav_url ?? null,
        image_url: track.image_url ?? null,
      },
      stems: {
        is_stem_composite: stems.length > 0,
        stem_type: track.stem_type ?? null,
        children_stems: stems,
      },
      stats: {
        play_count: track.play_count ?? 0,
        favorite_count: track.favorite_count ?? 0,
        share_count: track.share_count ?? 0,
      },
    },
    generation_logic: {
      model_name: track.model_version ?? track.raw_data?.model_display_name ?? track.raw_data?.operation?.model_display_name ?? null,
      mode: track.raw_data?.mode ?? track.raw_data?.op_type ?? track.raw_data?.operation?.op_type ?? null,
      ghostwriter_tier: track.raw_data?.ghostwriter_tier ?? null,
      instrument: track.raw_data?.instrument ?? null,
      prompt: {
        user_input: prompt,
        negative_prompt: negativePrompt,
        strength: promptStrength,
        style_tags: safeArray(track.raw_data?.style_tags),
      },
      transform: {
        type: extractTransformValue(track, 'transform_type', 'transform'),
        is_remix: Boolean(extractTransformValue(track, 'parent_id', 'parent_riff_id')),
        remix_mode: detectRemixMode(track),
        parent_riff_id: extractTransformValue(track, 'parent_id', 'parent_riff_id'),
        parent_clip_id: extractTransformValue(track, 'parent_clip_id'),
        offset_s: extractTransformValue(track, 'offset_s'),
        clip_start_s: extractTransformValue(track, 'clip_start_s'),
        clip_end_s: extractTransformValue(track, 'clip_end_s'),
        trim_start_s: extractTransformValue(track, 'trim_start_s'),
        trim_end_s: extractTransformValue(track, 'trim_end_s'),
      },
      conditions: extractConditions(track),
      lyrics_timestamped: safeArray(track.lyrics_timestamped ?? track.raw_data?.lyrics_timing),
      lyrics: track.lyrics ?? null,
      sound: track.sound ?? null,
    },
    video_subsystem: {
      has_video: Boolean(track.video_url ?? track.raw_data?.video_id),
      video_job_id: track.raw_data?.video_job_id ?? track.raw_data?.video_id ?? linkedVideoJobIds[0] ?? sessionVideoJobIds[0] ?? null,
      status: track.raw_data?.video_status ?? track.raw_data?.video?.status ?? null,
      video_url: track.video_url ?? null,
      metadata: {
        aspect_ratio: track.raw_data?.video_aspect_ratio ?? track.raw_data?.video?.aspect_ratio ?? null,
        motion_score: track.raw_data?.video_motion_score ?? track.raw_data?.video?.motion_score ?? null,
        style_reference_url: track.raw_data?.video_style_ref_url ?? track.raw_data?.video?.style_reference_url ?? null,
        start_s: track.raw_data?.video_start_s ?? track.raw_data?.video?.start_s ?? null,
        end_s: track.raw_data?.video_end_s ?? track.raw_data?.video?.end_s ?? null,
        prompt: track.raw_data?.video_prompt ?? track.raw_data?.video?.prompt ?? null,
        fps: track.raw_data?.video_fps ?? track.raw_data?.video?.fps ?? null,
        resolution: track.raw_data?.video_resolution ?? track.raw_data?.video?.resolution ?? null,
      },
    },
    ai_snapshot: {
      memories_applied: memories.map((item) => item.text),
      system_instructions_id: sessionSnapshot?.instructions ? 'session-inline' : null,
      applied_flows: flowList,
      metrics: {},
      config_snapshot: sessionSnapshot?.config_snapshot ?? {},
      prompt_enhancement_enabled: sessionSnapshot?.prompt_enhancement_enabled ?? null,
      internal_tags: [],
    },
    spaces_state: {
      is_space: false,
      space_id: null,
      code_snapshot: {
        main_ts: null,
        shader_glsl: null,
        files: {},
        params: {},
      },
      interactive_params: null,
    },
    analytics_and_meta: {
      privacy: {
        status: track.raw_data?.privacy_status ?? track.raw_data?.privacy ?? 'private',
        is_discoverable: Boolean(track.raw_data?.is_discoverable ?? track.raw_data?.allow_public_use ?? track.raw_data?.privacy === 'public'),
        published_at: track.raw_data?.published_at ?? null,
      },
      technical_specs: {
        audio_md5: track.audio_md5 ?? null,
        audio_codec: track.audio_codec ?? null,
        bitrate_kbps: track.bitrate_kbps ?? null,
        sample_rate_hz: track.sample_rate_hz ?? null,
        video: {
          codec: track.raw_data?.video_codec ?? null,
          fps: track.raw_data?.video_fps ?? null,
          resolution: track.raw_data?.video_resolution ?? null,
          bit_depth: track.raw_data?.video_bit_depth ?? null,
        },
      },
      engagement_metrics: {
        play_count: track.play_count ?? 0,
        skip_count: track.raw_data?.skip_count ?? 0,
        skip_ratio: track.raw_data?.skip_ratio ?? null,
        avg_completion_pct: track.raw_data?.avg_completion_pct ?? null,
        completion_rate: track.raw_data?.completion_rate ?? null,
        is_favorited_by_me: Boolean(track.raw_data?.is_favorited_by_me),
        peak_listener_segments: safeArray(track.raw_data?.peak_listener_segments),
      },
      sampling_context: {
        cfg_scale: track.raw_data?.cfg_scale ?? null,
        sampling_steps: track.raw_data?.sampling_steps ?? null,
        internal_model_id: track.raw_data?.internal_model_id ?? null,
        inference_time_ms: track.raw_data?.inference_time_ms ?? null,
      },
      lineage: {
        origin_id: track.origin_id ?? track.lineage?.origin_id ?? track.id,
        derivation_chain: safeArray(track.lineage?.chain),
        depth: track.derivation_depth ?? track.lineage?.depth ?? 0,
        branch_index: track.branch_index ?? track.lineage?.branch_index ?? 0,
      },
      social: {
        is_derivative: Boolean(extractTransformValue(track, 'parent_id', 'parent_riff_id')),
        source_user_id: track.raw_data?.source_user_id ?? track.raw_data?.author_id ?? null,
        original_track_id: track.raw_data?.original_track_id ?? extractTransformValue(track, 'parent_id', 'parent_riff_id'),
        in_playlists: safeArray(track.raw_data?.in_playlists),
        similar_tracks: safeArray(track.raw_data?.similar_tracks),
      },
    },
    metadata_expansion: {
      prompt_strength: promptStrength,
      temporal_shift: track.raw_data?.temporal_shift ?? null,
      model_specific: {
        lyria_version: track.raw_data?.lyria_version ?? null,
        model_hash: track.raw_data?.model_hash ?? null,
      },
      is_public: Boolean(track.raw_data?.is_public ?? track.raw_data?.allow_public_use ?? track.raw_data?.privacy === 'public'),
      is_featured: Boolean(track.raw_data?.is_featured),
      content_rating: track.raw_data?.content_rating ?? null,
    },
    raw_data_anchor: {
      raw_track: track.raw_data ?? {},
      session_snapshot: sessionSnapshot?.payload ?? null,
    },
    timestamps: {
      archived_at: new Date().toISOString(),
      last_synced: new Date().toISOString(),
    },
  };
}

export function buildSessionIndex(sessionRecords) {
  const byTrackId = new Map();
  const byOperationId = new Map();
  const bySessionId = new Map();
  const videoJobsByTrackId = new Map();

  for (const record of sessionRecords) {
    const sessionId = record.conversation_id ?? record.payload?.id ?? null;
    if (!sessionId) continue;
    const snapshot = buildSessionSnapshot(record);
    bySessionId.set(sessionId, snapshot);

    const clipIds = safeArray(record.linked?.linked_clip_ids);
    for (const clipId of clipIds) {
      byTrackId.set(clipId, sessionId);
    }

    const videoJobIds = safeArray(record.linked?.linked_video_job_ids);
    if (clipIds.length && videoJobIds.length) {
      for (const clipId of clipIds) {
        const existing = videoJobsByTrackId.get(clipId) ?? [];
        for (const jobId of videoJobIds) {
          if (!existing.includes(jobId)) existing.push(jobId);
        }
        videoJobsByTrackId.set(clipId, existing);
      }
    }

    const operationIds = safeArray(record.linked?.linked_operation_ids);
    for (const operationId of operationIds) {
      byOperationId.set(operationId, sessionId);
    }
  }

  return { byTrackId, byOperationId, bySessionId, videoJobsByTrackId };
}
