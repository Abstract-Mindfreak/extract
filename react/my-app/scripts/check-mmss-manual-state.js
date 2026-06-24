const { getPool } = require('../db');

async function main() {
  const pool = getPool('abstract-mind-lab');
  const albumCount = await pool.query('select count(*)::int as count from mmss_albums');
  const collectionCount = await pool.query('select count(*)::int as count from mmss_collection');
  const skillCount = await pool.query("select count(*)::int as count from mmss_skills where skill_id in ('json_prompt_compiler','provenance_recorder','album_sequencer')");
  const sampleAlbums = await pool.query("select album_id, title from mmss_albums order by updated_at desc limit 5");
  console.log(JSON.stringify({
    albumCount: albumCount.rows[0],
    collectionCount: collectionCount.rows[0],
    skillCount: skillCount.rows[0],
    sampleAlbums: sampleAlbums.rows,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.stack || error);
    process.exit(1);
  });
