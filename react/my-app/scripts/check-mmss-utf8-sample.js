const { getPool } = require('../db');

async function main() {
  const pool = getPool('abstract-mind-lab');
  const skills = await pool.query(`
    select skill_id, name, description
    from mmss_skills
    where skill_id in ('album_architect', 'json_prompt_compiler', 'provenance_recorder')
    order by skill_id
  `);
  const trees = await pool.query(`
    select tree_id, root_goal
    from mmss_skill_trees
    where tree_id in ('tree_manual_album_forge_ru', 'tree_manual_collection_album_track_fragment')
    order by tree_id
  `);
  console.log(JSON.stringify({ skills: skills.rows, trees: trees.rows }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.stack || error);
    process.exit(1);
  });
