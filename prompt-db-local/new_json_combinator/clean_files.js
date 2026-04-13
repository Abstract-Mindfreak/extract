const fs = require('fs');
const path = require('path');
const dir = 'd:/WORK/CLIENTS/extract/prompt-db-local/new_json_combinator';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.json'));
files.forEach(file => {
  const filepath = path.join(dir, file);
  const content = fs.readFileSync(filepath, 'utf8');
  const cleaned = content.replace(/^\s*\d+→\d+\s*/gm, '');
  fs.writeFileSync(filepath, cleaned, 'utf8');
  console.log('Cleaned:', file);
});
console.log('Done cleaning all files!');
