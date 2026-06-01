const fs = require('fs');
const db = JSON.parse(fs.readFileSync('local_db.json', 'utf8'));

db.projects.forEach((p) => {
  const filename = `scratch/project_${p.name.replace(/[^a-zA-Z0-9]/g, '_')}_frontend.html`;
  fs.writeFileSync(filename, p.frontend || '', 'utf8');
  console.log(`Wrote ${filename}`);
});
