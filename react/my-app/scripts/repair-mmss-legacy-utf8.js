const { getPool } = require('../db');

async function main() {
  const pool = getPool('abstract-mind-lab');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE mmss_skill_sets
      SET
        name = $2,
        purpose = $3,
        metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{language}', '"ru"', true),
        updated_at = NOW()
      WHERE skill_set_id = $1
    `, [
      'skillset_manual_collection_pipeline',
      'Ручной Конвейер Коллекция → Альбом → Трек → Фрагмент',
      'Стартовый pipeline: коллекция → альбом → трек → фрагмент с явной фиксацией примененных skills на каждом шаге.',
    ]);

    await client.query(`
      UPDATE mmss_skill_trees
      SET
        root_goal = $2,
        metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{language}', '"ru"', true),
        updated_at = NOW()
      WHERE tree_id = $1
    `, [
      'tree_manual_collection_album_track_fragment',
      'Ручной стартовый слой MMSS: collection → album → track → fragment для локальной LLM и дальнейшего расширения skill pipeline.',
    ]);

    await client.query(`
      UPDATE mmss_collection
      SET
        title = $2,
        content = $3,
        metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{language}', '"ru"', true),
        updated_at = NOW()
      WHERE entry_id = $1
    `, [
      'collection_mmss_manual_runtime_root',
      'Корневой Ручной MMSS Runtime',
      'Корневой слой для ручных MMSS-инструкций, альбомного контекста, трековых prompt-узлов и vector-fragment anchors.',
    ]);

    await client.query(`
      UPDATE mmss_collection
      SET
        title = $2,
        content = $3,
        metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{language}', '"ru"', true),
        updated_at = NOW()
      WHERE entry_id = $1
    `, [
      'collection_mmss_omega_album_node',
      'Альбомный Узел Omega / Φ_total',
      'Альбомный узел, объединяющий длинные ручные протоколы Omega/Φ_total с опорными треками и их vector fragments.',
    ]);

    await client.query(`
      UPDATE mmss_albums
      SET
        title = $2,
        description = $3,
        metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{language}', '"ru"', true),
        updated_at = NOW()
      WHERE album_id = $1
    `, [
      'album_mmss_omega_protocol_manual_corpus',
      'Omega Protocol / Φ_total Manual Corpus',
      'Ручной альбомный корпус для локальной LLM: связывает длинные flowmusic manual instructions, ключевые MMSS track prompts и векторные fragment anchors.',
    ]);

    await client.query('COMMIT');
    console.log('legacy utf8 repair complete');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.stack || error);
    process.exit(1);
  });
