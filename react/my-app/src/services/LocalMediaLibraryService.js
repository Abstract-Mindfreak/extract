const API_BASE = "http://localhost:3456/api";

function escapeSqlString(value) {
  return String(value ?? "").replace(/'/g, "''");
}

async function query(sql) {
  const response = await fetch(`${API_BASE}/db/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ sql }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload.data || [];
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

class LocalMediaLibraryService {
  async loadLibraryCatalog() {
    try {
      const payload = await fetchJson(`${API_BASE}/library/catalog`);
      const accounts = Array.isArray(payload?.accounts) ? payload.accounts : [];
      const byTrackId = new Map();

      for (const account of accounts) {
        const tracks = Array.isArray(account?.tracks) ? account.tracks : [];
        for (const track of tracks) {
          if (!track?.trackId) continue;
          byTrackId.set(track.trackId, {
            accountId: account.accountId || null,
            audioUrl: track.audioUrl || null,
            coverUrl: track.coverUrl || null,
            metaUrl: track.metaUrl || null,
          });
        }
      }

      return byTrackId;
    } catch {
      return new Map();
    }
  }

  async loadSummary() {
    const rows = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM tracks) AS tracks,
        (SELECT COUNT(*)::int FROM sessions) AS sessions,
        (SELECT COUNT(*)::int FROM tracks WHERE is_space = true) AS spaces,
        (
          SELECT COUNT(*)::int
          FROM sessions
          WHERE ai_snapshot::text ILIKE '%video__create_music_video%'
             OR ai_snapshot::text ILIKE '%video__propose_music_video%'
        ) AS music_videos,
        (
          SELECT COUNT(*)::int
          FROM tracks
          WHERE jsonb_typeof(raw_data #> '{raw_track,in_playlists}') = 'array'
            AND jsonb_array_length(raw_data #> '{raw_track,in_playlists}') > 0
        ) AS playlists,
        (SELECT COUNT(*)::int FROM applied_flows) AS flows,
        (SELECT COUNT(*)::int FROM applied_memories) AS memories
    `);
    return rows[0] || {};
  }

  async loadTracks() {
    const [rows, libraryCatalog] = await Promise.all([
      query(`
      SELECT
        id,
        title,
        session_id,
        created_at,
        duration_s,
        privacy_status,
        is_discoverable,
        play_count,
        favorite_count,
        video_job_id,
        video_url,
        has_video,
        is_space,
        prompt,
        model_name,
        generation_mode,
        transform_type,
        wav_url,
        image_url,
        COALESCE(jsonb_array_length(lyrics_timestamped), 0) AS lyrics_marker_count,
        raw_data #>> '{raw_track,op_type}' AS op_type,
        CASE
          WHEN jsonb_typeof(raw_data #> '{raw_track,in_playlists}') = 'array'
          THEN jsonb_array_length(raw_data #> '{raw_track,in_playlists}')
          ELSE 0
        END AS playlist_count
      FROM tracks
      ORDER BY created_at DESC NULLS LAST, title ASC
    `),
      this.loadLibraryCatalog(),
    ]);

    return rows.map((row) => {
      const libraryEntry = libraryCatalog.get(row.id);
      return {
        ...row,
        account_id: libraryEntry?.accountId || null,
        audio_url_local: libraryEntry?.audioUrl || null,
        cover_url_local: libraryEntry?.coverUrl || null,
        meta_url_local: libraryEntry?.metaUrl || null,
      };
    });
  }

  async loadSessions() {
    return query(`
      SELECT
        id,
        title,
        created_at,
        updated_at,
        COALESCE(jsonb_array_length(ai_snapshot #> '{payload,messages}'), 0) AS message_count,
        COALESCE(jsonb_array_length(ai_snapshot -> 'applied_flows'), 0) AS flow_count,
        COALESCE(jsonb_array_length(ai_snapshot -> 'memories_applied'), 0) AS memory_count,
        CASE
          WHEN ai_snapshot::text ILIKE '%video__create_music_video%'
            OR ai_snapshot::text ILIKE '%video__propose_music_video%'
          THEN TRUE
          ELSE FALSE
        END AS has_video_tool
      FROM sessions
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    `);
  }

  async loadTrackDetail(trackId) {
    const safeTrackId = escapeSqlString(trackId);
    const [rows, libraryCatalog] = await Promise.all([
      query(`
        SELECT to_jsonb(t) AS payload
        FROM tracks t
        WHERE id = '${safeTrackId}'
        LIMIT 1
      `),
      this.loadLibraryCatalog(),
    ]);
    const payload = rows[0]?.payload || null;
    if (!payload) return null;

    const libraryEntry = libraryCatalog.get(trackId);
    return {
      ...payload,
      account_id: libraryEntry?.accountId || null,
      audio_url_local: libraryEntry?.audioUrl || null,
      cover_url_local: libraryEntry?.coverUrl || null,
      meta_url_local: libraryEntry?.metaUrl || null,
    };
  }

  async loadSessionDetail(sessionId) {
    const safeSessionId = escapeSqlString(sessionId);
    const [sessionRows, trackRows, libraryCatalog] = await Promise.all([
      query(`
        SELECT to_jsonb(s) AS payload
        FROM sessions s
        WHERE id = '${safeSessionId}'
        LIMIT 1
      `),
      query(`
        SELECT
          id,
          title,
          created_at,
          duration_s,
          privacy_status,
          play_count,
          favorite_count,
          video_job_id,
          image_url,
          prompt
        FROM tracks
        WHERE session_id = '${safeSessionId}'
        ORDER BY created_at ASC NULLS LAST, title ASC
      `),
      this.loadLibraryCatalog(),
    ]);

    return {
      payload: sessionRows[0]?.payload || null,
      tracks: trackRows.map((row) => {
        const libraryEntry = libraryCatalog.get(row.id);
        return {
          ...row,
          account_id: libraryEntry?.accountId || null,
          audio_url_local: libraryEntry?.audioUrl || null,
          cover_url_local: libraryEntry?.coverUrl || null,
          meta_url_local: libraryEntry?.metaUrl || null,
        };
      }),
    };
  }
}

const localMediaLibraryService = new LocalMediaLibraryService();

export default localMediaLibraryService;
