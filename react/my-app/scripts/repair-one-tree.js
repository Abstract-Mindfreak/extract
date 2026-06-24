const { getPool } = require('../db');

async function main() {
  const pool = getPool('abstract-mind-lab');
  const goal = 'Ручной стартовый слой MMSS: collection → album → track → fragment для локальной LLM и дальнейшего расширения skill pipeline.';
  const update = await pool.query(
    'update mmss_skill_trees set root_goal = $2, updated_at = now() where tree_id = $1 returning tree_id, root_goal',
    ['tree_manual_collection_album_track_fragment', goal],
  );
  console.log(JSON.stringify({ rowCount: update.rowCount, rows: update.rows }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.stack || error);
    process.exit(1);
  });
