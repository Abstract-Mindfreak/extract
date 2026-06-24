const { getPool } = require('../db');
const { ensureSchema } = require('../server/mmssRuntimePersistenceService');

const DATABASE = 'abstract-mind-lab';

const ALBUM_BLUEPRINTS = [
  {
    albumId: 'album_manual_01_omega_protocol',
    collectionEntryId: 'collection_album_manual_01_omega_protocol',
    title: 'Омега-Протокол: Рекурсивная Сингулярность',
    description: 'Альбомный слой для треков с Ω-Protocol, рекурсией, фазовыми переходами и terminal/focus логикой.',
    domain: 'Omega / Protocol / Recursive Psy',
    keywords: ['ω-protocol', 'omega', 'phase', 'singularity', 'recursive', 'terminal', 'focus', 'samāpana'],
  },
  {
    albumId: 'album_manual_02_dark_psy_fractal',
    collectionEntryId: 'collection_album_manual_02_dark_psy_fractal',
    title: 'Фрактальный Тёмный Пси-Архив',
    description: 'Подборка тёмных psy-паттернов, фрактальной драматургии и биомеханической динамики.',
    domain: 'Dark Psy / Fractal / Biomechanical',
    keywords: ['dark psy', 'psytrance', 'fractal', 'biomechanical', 'vacuum-ether', 'liquid scratch', 'eldritch'],
  },
  {
    albumId: 'album_manual_03_phi_total',
    collectionEntryId: 'collection_album_manual_03_phi_total',
    title: 'Φ_total: Метаструктуры И Звуковая Логика',
    description: 'Треки вокруг Φ_total, мета-операторов, звуковой логики и процедурной композиции.',
    domain: 'Φ_total / Meta Operators / Procedural Audio',
    keywords: ['φ_total', 'algorithmic', 'procedural', 'meta', 'mandelbrot', 'fibonacci', 'logic'],
  },
  {
    albumId: 'album_manual_04_industrial_recursive',
    collectionEntryId: 'collection_album_manual_04_industrial_recursive',
    title: 'Рекурсивная Индустриальная Пульсация',
    description: 'Индустриальные, механические и рекурсивные треки с упором на pressure, dust и granular motion.',
    domain: 'Industrial / Recursive / Granular',
    keywords: ['industrial', 'mechanical', 'granular', 'pulse', 'stereo dust', 'recursive', 'low-end'],
  },
  {
    albumId: 'album_manual_05_quantum_protein',
    collectionEntryId: 'collection_album_manual_05_quantum_protein',
    title: 'Квантовые Белковые Фракталы',
    description: 'Слой квантовых, белковых и биологических мотивов для научно-фантастических и абстрактных генераций.',
    domain: 'Quantum / Protein / Biological',
    keywords: ['protein', 'quantum', 'allostery', 'molecular', 'biological', 'fractal', 'coherence'],
  },
  {
    albumId: 'album_manual_06_latin_urban',
    collectionEntryId: 'collection_album_manual_06_latin_urban',
    title: 'Латинский Городской Контур',
    description: 'Городские латинские и акустические треки с упором на groove, bridge и мягкое развитие.',
    domain: 'Latin / Urban / Acoustic',
    keywords: ['latin', 'urban', 'acoustic guitar', 'groove', 'bridge', 'smooth flow'],
  },
  {
    albumId: 'album_manual_07_cosmic_bebop',
    collectionEntryId: 'collection_album_manual_07_cosmic_bebop',
    title: 'Космический Бибоп И Плоские Разломы',
    description: 'Космический ужас, bebop, avant-garde и planar resonance как отдельный альбомный маршрут.',
    domain: 'Cosmic / Bebop / Avant-garde',
    keywords: ['bebop', 'cosmic', 'planar', 'horror', 'avant-garde', 'virtuoso', 'dissonance'],
  },
  {
    albumId: 'album_manual_08_ambient_ether',
    collectionEntryId: 'collection_album_manual_08_ambient_ether',
    title: 'Эфирный Амбиент И Светящиеся Хвосты',
    description: 'Альбом для ether, luminous, ambient, temple IR и long-tail resolution паттернов.',
    domain: 'Ambient / Ether / Temple IR',
    keywords: ['ambient', 'ether', 'luminous', 'temple', 'reverb tail', 'resolution', 'no drums'],
  },
  {
    albumId: 'album_manual_09_glitch_bio',
    collectionEntryId: 'collection_album_manual_09_glitch_bio',
    title: 'Биоглитч И Нейтральные Сети',
    description: 'Глитчевые, нейросетевые и микроскопические звуковые слои для сложных экспериментальных генераций.',
    domain: 'Glitch / Bio / Neural',
    keywords: ['glitch', 'neural', 'neutral network', 'microscopic', 'bio-electronic', 'idm'],
  },
  {
    albumId: 'album_manual_10_hybrid_experimental',
    collectionEntryId: 'collection_album_manual_10_hybrid_experimental',
    title: 'Гибридный Экспериментальный Резерв',
    description: 'Резервный альбомный слой для гибридных, редких и плохо классифицируемых prompt/JSON узлов.',
    domain: 'Hybrid / Experimental / Reserve',
    keywords: ['experimental', 'hybrid', 'cinematic', 'evolving', 'complex', 'atmospheric'],
  },
];

const EXPANDED_SKILLS = [
  {
    skill_id: 'collection_curator',
    name: 'Куратор Коллекции',
    description: 'Собирает MMSS-коллекции и связывает инструкции, альбомные узлы, треки и фрагменты в понятный граф.',
    inputs: ['mmss_custom_instructions', 'mmss_tracks_prompts', 'mmss_generation_results'],
    outputs: ['mmss_collection_root'],
    prerequisites: ['runtime health available'],
    failure_modes: ['orphaned collection nodes', 'weak provenance'],
    metrics: { priority: 'high', layer: 'collection' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'album_architect',
    name: 'Архитектор Альбома',
    description: 'Формирует альбомный слой и определяет тематическую связность между ручными протоколами, prompt-узлами и фрагментами.',
    inputs: ['collection nodes', 'track prompts', 'manual protocols'],
    outputs: ['mmss_albums'],
    prerequisites: ['collection_curator'],
    failure_modes: ['album too broad', 'theme drift'],
    metrics: { priority: 'high', layer: 'album' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'track_prompt_mapper',
    name: 'Маппер Трековых Промтов',
    description: 'Привязывает tracks.prompt и связанные JSON-узлы к альбомным и коллекционным вершинам.',
    inputs: ['tracks', 'mmss_tracks_prompts'],
    outputs: ['track nodes'],
    prerequisites: ['album_architect'],
    failure_modes: ['duplicate prompt mapping'],
    metrics: { priority: 'high', layer: 'track' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'fragment_vector_linker',
    name: 'Линкер Векторных Фрагментов',
    description: 'Создает фрагментные опоры для векторизованных данных, чтобы LLM могла двигаться от трека к retrieval-фрагменту.',
    inputs: ['rag_document_embeddings', 'track nodes'],
    outputs: ['fragment anchors'],
    prerequisites: ['track_prompt_mapper'],
    failure_modes: ['missing vector fragment refs'],
    metrics: { priority: 'high', layer: 'fragment' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'instruction_parser_manual',
    name: 'Парсер Ручных Инструкций',
    description: 'Разбирает длинные flowmusic-инструкции на онтологические, операторные и procedural блоки.',
    inputs: ['mmss_custom_instructions'],
    outputs: ['instruction sublayers'],
    prerequisites: [],
    failure_modes: ['operator loss', 'axiom collapse'],
    metrics: { priority: 'medium', layer: 'instruction' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'omega_breath_bridge',
    name: 'Мост Omega Breath',
    description: 'Связывает Omega Breath ASE, Unified Console и runtime-граф как tool-set для operator-aware работы.',
    inputs: ['omega-breath mode', 'ASE Console'],
    outputs: ['tool set bridge'],
    prerequisites: ['instruction_parser_manual'],
    failure_modes: ['UI/runtime drift'],
    metrics: { priority: 'medium', layer: 'tools' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'skill_tree_pathfinder_manual',
    name: 'Маршрутизатор По Дереву Навыков',
    description: 'Прокладывает путь по дереву навыков от пользовательской задачи до слоя коллекции, альбома, трека и фрагмента.',
    inputs: ['skill tree', 'active query'],
    outputs: ['execution path'],
    prerequisites: ['collection_curator', 'album_architect', 'track_prompt_mapper', 'fragment_vector_linker'],
    failure_modes: ['wrong branch selection'],
    metrics: { priority: 'high', layer: 'routing' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'toolset_resolver',
    name: 'Резолвер Инструментария',
    description: 'Определяет, какие инструменты и tool-sets нужны для работы с длинными manual instructions и их дальнейшей мутацией.',
    inputs: ['custom instructions', 'omega bridge', 'skill tree path'],
    outputs: ['tool recommendations'],
    prerequisites: ['omega_breath_bridge'],
    failure_modes: ['toolset under-specification'],
    metrics: { priority: 'medium', layer: 'tools' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'json_prompt_compiler',
    name: 'Компилятор JSON И Промтов',
    description: 'Собирает итоговый трековый узел из prompt-текста, JSON-фрагмента и вспомогательных полей сессии.',
    inputs: ['prompt text', 'json fragment', 'session fields'],
    outputs: ['normalized track payload'],
    prerequisites: ['track_prompt_mapper'],
    failure_modes: ['schema drift', 'field truncation'],
    metrics: { priority: 'high', layer: 'assembly' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'session_json_sampler',
    name: 'Сэмплер Сессионного JSON',
    description: 'Извлекает наиболее полезные JSON-фрагменты из сессий и готовит их как сырье для mmss_filtered и album context.',
    inputs: ['sessions', 'session payloads'],
    outputs: ['session json samples'],
    prerequisites: ['instruction_parser_manual'],
    failure_modes: ['oversampling noise', 'missed high-value blocks'],
    metrics: { priority: 'medium', layer: 'session' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'ontology_linker',
    name: 'Линкер Онтологии MMSS',
    description: 'Связывает треки, фрагменты и инструкции с операторами, фазами и доменными паттернами MMSS.',
    inputs: ['tracks', 'instructions', 'phase patterns', 'domain patterns'],
    outputs: ['ontology links'],
    prerequisites: ['json_prompt_compiler'],
    failure_modes: ['weak semantic match'],
    metrics: { priority: 'high', layer: 'ontology' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'album_sequencer',
    name: 'Секвенсор Альбома',
    description: 'Выстраивает треки внутри альбома как понятную последовательность: вход, развитие, перелом, фокус, завершение.',
    inputs: ['album candidates', 'track nodes'],
    outputs: ['ordered album tracklist'],
    prerequisites: ['album_architect'],
    failure_modes: ['poor pacing', 'repetition'],
    metrics: { priority: 'medium', layer: 'album' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
  {
    skill_id: 'provenance_recorder',
    name: 'Рекордер Происхождения',
    description: 'Фиксирует, какие skills и tools были применены на каждом шаге сборки коллекции, альбома, трека и фрагмента.',
    inputs: ['execution events'],
    outputs: ['provenance trail'],
    prerequisites: [],
    failure_modes: ['missing trail'],
    metrics: { priority: 'high', layer: 'audit' },
    metadata: { origin: 'manual_seed_utf8', language: 'ru' },
  },
];

function scoreTrack(track, keywords) {
  const hay = `${track.title || ''} ${track.prompt || ''}`.toLowerCase();
  return keywords.reduce((score, keyword) => (hay.includes(keyword) ? score + 2 : score), 0);
}

function allocateAlbums(tracks) {
  const remaining = [...tracks];
  const albums = [];

  for (const blueprint of ALBUM_BLUEPRINTS) {
    const ranked = remaining
      .map((track) => ({ track, score: scoreTrack(track, blueprint.keywords) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(b.track.created_at).localeCompare(String(a.track.created_at)));

    const selected = [];
    for (const entry of ranked) {
      if (selected.length >= 10) break;
      selected.push(entry.track);
    }

    for (const track of selected) {
      const index = remaining.findIndex((item) => String(item.id) === String(track.id));
      if (index >= 0) remaining.splice(index, 1);
    }

    albums.push({ ...blueprint, tracks: selected });
  }

  for (const album of albums) {
    while (album.tracks.length < 10 && remaining.length > 0) {
      album.tracks.push(remaining.shift());
    }
  }

  return albums;
}

async function main() {
  await ensureSchema(DATABASE);
  const pool = getPool(DATABASE);
  const client = await pool.connect();

  try {
    const trackRows = await client.query(`
      SELECT id, title, prompt, session_id, created_at
      FROM tracks
      WHERE prompt IS NOT NULL
        AND BTRIM(prompt) <> ''
      ORDER BY created_at DESC NULLS LAST
      LIMIT 220
    `);
    const albums = allocateAlbums(trackRows.rows).filter((album) => album.tracks.length === 10);
    const selectedTrackIds = albums.flatMap((album) => album.tracks.map((track) => String(track.id)));

    const promptRows = await client.query(`
      SELECT prompt_id, track_id, prompt_text, updated_at
      FROM mmss_tracks_prompts
      WHERE track_id = ANY($1::text[])
    `, [selectedTrackIds]);

    const instructionRows = await client.query(`
      SELECT instruction_id, title, category, updated_at
      FROM mmss_custom_instructions
      ORDER BY updated_at DESC
      LIMIT 5
    `);

    if (albums.length < 10) {
      throw new Error(`Expected 10 albums with 10 tracks each, got ${albums.length}`);
    }

    await client.query('BEGIN');

    for (const skill of EXPANDED_SKILLS) {
      await client.query(`
        INSERT INTO mmss_skills (
          skill_id, name, description, inputs, outputs, prerequisites, failure_modes, metrics, metadata, updated_at
        )
        VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,NOW())
        ON CONFLICT (skill_id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          inputs = EXCLUDED.inputs,
          outputs = EXCLUDED.outputs,
          prerequisites = EXCLUDED.prerequisites,
          failure_modes = EXCLUDED.failure_modes,
          metrics = EXCLUDED.metrics,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [
        skill.skill_id,
        skill.name,
        skill.description,
        JSON.stringify(skill.inputs || []),
        JSON.stringify(skill.outputs || []),
        JSON.stringify(skill.prerequisites || []),
        JSON.stringify(skill.failure_modes || []),
        JSON.stringify(skill.metrics || {}),
        JSON.stringify(skill.metadata || {}),
      ]);
    }

    const skillIds = EXPANDED_SKILLS.map((entry) => entry.skill_id);
    const skillSetId = 'skillset_manual_album_forge_ru';
    const skillTreeId = 'tree_manual_album_forge_ru';

    await client.query(`
      INSERT INTO mmss_skill_sets (
        skill_set_id, name, purpose, skills, internal_flow, shared_entities, entry_points, exit_artifacts, metadata, updated_at
      )
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,NOW())
      ON CONFLICT (skill_set_id) DO UPDATE SET
        name = EXCLUDED.name,
        purpose = EXCLUDED.purpose,
        skills = EXCLUDED.skills,
        internal_flow = EXCLUDED.internal_flow,
        shared_entities = EXCLUDED.shared_entities,
        entry_points = EXCLUDED.entry_points,
        exit_artifacts = EXCLUDED.exit_artifacts,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `, [
      skillSetId,
      'Русский Набор Ручной Альбомной Сборки',
      'Стартовый набор для ручной сборки коллекций, альбомов, треков и фрагментов из JSON и prompt-слоев с полной фиксацией примененных tools.',
      JSON.stringify(skillIds),
      JSON.stringify([
        'instruction_parser_manual',
        'session_json_sampler',
        'json_prompt_compiler',
        'ontology_linker',
        'collection_curator',
        'album_architect',
        'album_sequencer',
        'track_prompt_mapper',
        'fragment_vector_linker',
        'skill_tree_pathfinder_manual',
        'toolset_resolver',
        'provenance_recorder',
      ]),
      JSON.stringify(['mmss_collection', 'mmss_albums', 'mmss_tracks_prompts', 'mmss_custom_instructions', 'rag_document_embeddings']),
      JSON.stringify(['ручные flowmusic-инструкции', 'последние generation results', 'синхронизированные track prompts']),
      JSON.stringify(['10 albums x 10 tracks', 'tool trails', 'album graph', 'track graph', 'fragment anchors']),
      JSON.stringify({ origin: 'manual_seed_utf8', language: 'ru' }),
    ]);

    await client.query(`
      INSERT INTO mmss_skill_trees (
        tree_id, root_goal, version, skill_sets, global_entities, cross_links, owner_scope, metadata, updated_at
      )
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8::jsonb,NOW())
      ON CONFLICT (tree_id) DO UPDATE SET
        root_goal = EXCLUDED.root_goal,
        version = EXCLUDED.version,
        skill_sets = EXCLUDED.skill_sets,
        global_entities = EXCLUDED.global_entities,
        cross_links = EXCLUDED.cross_links,
        owner_scope = EXCLUDED.owner_scope,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `, [
      skillTreeId,
      'Ручной русский слой MMSS: 10 альбомов по 10 треков, где каждый трек собран из prompt и JSON-опор, а вся цепочка tools зафиксирована.',
      1,
      JSON.stringify([skillSetId]),
      JSON.stringify(['mmss_collection', 'mmss_albums', 'mmss_tracks_prompts', 'mmss_custom_instructions', 'rag_document_embeddings', 'omega-breath-ase', 'ASE Unified Console']),
      JSON.stringify([
        { from: 'mmss_custom_instructions', to: 'mmss_collection', relation: 'seeds_collection' },
        { from: 'mmss_collection', to: 'mmss_albums', relation: 'contains_albums' },
        { from: 'mmss_albums', to: 'tracks', relation: 'contains_tracks' },
        { from: 'tracks', to: 'mmss_tracks_prompts', relation: 'prompt_source' },
        { from: 'tracks', to: 'rag_document_embeddings', relation: 'vector_fragment_source' },
        { from: 'omega-breath-ase', to: 'toolset_resolver', relation: 'tool_context' },
      ]),
      'manual_album_seed_ru',
      JSON.stringify({ origin: 'manual_seed_utf8', language: 'ru', applied_skill_set: skillSetId }),
    ]);

    const rootCollectionId = 'collection_manual_albums_ru_root';
    await client.query(`
      INSERT INTO mmss_collection (
        entry_id, category, title, content, source_ref, score, payload, metadata, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,NOW())
      ON CONFLICT (entry_id) DO UPDATE SET
        category = EXCLUDED.category,
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        source_ref = EXCLUDED.source_ref,
        score = EXCLUDED.score,
        payload = EXCLUDED.payload,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `, [
      rootCollectionId,
      'collection_root',
      'MMSS Русский Ручной Альбомный Корень',
      'Корневой слой для десяти ручных альбомов, собранных из промтов, JSON-опор, custom instructions и vector fragments.',
      'manual_album_seed_ru',
      0.99,
      JSON.stringify({
        album_refs: albums.map((album) => album.albumId),
        instruction_refs: instructionRows.rows.map((row) => row.instruction_id),
        skill_tree_ref: skillTreeId,
      }),
      JSON.stringify({
        tools_used: ['collection_curator', 'album_architect', 'album_sequencer', 'provenance_recorder'],
        language: 'ru',
      }),
    ]);

    for (const [albumIndex, album] of albums.entries()) {
      const albumTrackRefs = [];
      const albumFragmentRefs = [];

      await client.query(`
        INSERT INTO mmss_collection (
          entry_id, category, title, content, source_ref, score, payload, metadata, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,NOW())
        ON CONFLICT (entry_id) DO UPDATE SET
          category = EXCLUDED.category,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          source_ref = EXCLUDED.source_ref,
          score = EXCLUDED.score,
          payload = EXCLUDED.payload,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [
        album.collectionEntryId,
        'album_node',
        album.title,
        album.description,
        album.albumId,
        0.95,
        JSON.stringify({
          parent_collection: rootCollectionId,
          track_count: album.tracks.length,
          domain: album.domain,
        }),
        JSON.stringify({
          tools_used: ['album_architect', 'album_sequencer', 'toolset_resolver', 'provenance_recorder'],
          language: 'ru',
        }),
      ]);

      for (const [trackIndex, track] of album.tracks.entries()) {
        const promptRow = promptRows.rows.find((row) => String(row.track_id) === String(track.id));
        const trackEntryId = `collection_${album.albumId}_track_${trackIndex + 1}`;
        const fragmentEntryId = `collection_${album.albumId}_fragment_${trackIndex + 1}`;
        const promptText = promptRow?.prompt_text || track.prompt || '';
        const jsonTrackPayload = {
          track_id: track.id,
          title: track.title,
          session_id: track.session_id,
          prompt_id: promptRow?.prompt_id || null,
          prompt_excerpt: promptText.slice(0, 400),
          album_id: album.albumId,
          album_title: album.title,
        };

        albumTrackRefs.push({
          track_id: track.id,
          track_entry_id: trackEntryId,
          title: track.title,
          position: trackIndex + 1,
        });
        albumFragmentRefs.push({
          fragment_entry_id: fragmentEntryId,
          source_table: 'rag_document_embeddings',
          source_id: String(track.id),
          position: trackIndex + 1,
        });

        await client.query(`
          INSERT INTO mmss_collection (
            entry_id, category, title, content, source_ref, score, payload, metadata, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,NOW())
          ON CONFLICT (entry_id) DO UPDATE SET
            category = EXCLUDED.category,
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            source_ref = EXCLUDED.source_ref,
            score = EXCLUDED.score,
            payload = EXCLUDED.payload,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `, [
          trackEntryId,
          'track_node',
          `${albumIndex + 1}.${trackIndex + 1} ${track.title || `Track ${track.id}`}`,
          promptText,
          `tracks:${track.id}`,
          0.9,
          JSON.stringify({
            json_fragment: jsonTrackPayload,
            parent_album: album.albumId,
          }),
          JSON.stringify({
            tools_used: ['json_prompt_compiler', 'track_prompt_mapper', 'ontology_linker', 'provenance_recorder'],
            language: 'ru',
          }),
        ]);

        await client.query(`
          INSERT INTO mmss_collection (
            entry_id, category, title, content, source_ref, score, payload, metadata, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,NOW())
          ON CONFLICT (entry_id) DO UPDATE SET
            category = EXCLUDED.category,
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            source_ref = EXCLUDED.source_ref,
            score = EXCLUDED.score,
            payload = EXCLUDED.payload,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `, [
          fragmentEntryId,
          'fragment_vector_anchor',
          `${albumIndex + 1}.${trackIndex + 1} ${track.title || `Track ${track.id}`} :: векторный фрагмент`,
          promptText.slice(0, 1200),
          `rag_document_embeddings:${track.id}`,
          0.87,
          JSON.stringify({
            json_fragment: jsonTrackPayload,
            source_table: 'rag_document_embeddings',
            source_id: String(track.id),
            parent_track_entry: trackEntryId,
          }),
          JSON.stringify({
            tools_used: ['fragment_vector_linker', 'skill_tree_pathfinder_manual', 'provenance_recorder'],
            language: 'ru',
          }),
        ]);
      }

      await client.query(`
        INSERT INTO mmss_albums (
          album_id, collection_entry_id, title, description, domain, track_refs, fragment_refs, instruction_refs, metadata, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,NOW())
        ON CONFLICT (album_id) DO UPDATE SET
          collection_entry_id = EXCLUDED.collection_entry_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          domain = EXCLUDED.domain,
          track_refs = EXCLUDED.track_refs,
          fragment_refs = EXCLUDED.fragment_refs,
          instruction_refs = EXCLUDED.instruction_refs,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [
        album.albumId,
        album.collectionEntryId,
        album.title,
        album.description,
        album.domain,
        JSON.stringify(albumTrackRefs),
        JSON.stringify(albumFragmentRefs),
        JSON.stringify(instructionRows.rows.map((row) => row.instruction_id)),
        JSON.stringify({
          tools_used: [
            'instruction_parser_manual',
            'session_json_sampler',
            'json_prompt_compiler',
            'ontology_linker',
            'collection_curator',
            'album_architect',
            'album_sequencer',
            'track_prompt_mapper',
            'fragment_vector_linker',
            'skill_tree_pathfinder_manual',
            'toolset_resolver',
            'provenance_recorder',
          ],
          language: 'ru',
          track_count: album.tracks.length,
        }),
      ]);
    }

    await client.query('COMMIT');

    console.log(JSON.stringify({
      albumsCreated: albums.map((album) => ({
        albumId: album.albumId,
        title: album.title,
        trackCount: album.tracks.length,
      })),
      skillSetId,
      skillTreeId,
      instructionCount: instructionRows.rows.length,
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
