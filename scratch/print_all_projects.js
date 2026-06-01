const fs = require('fs');
const db = JSON.parse(fs.readFileSync('local_db.json', 'utf8'));
db.projects.forEach((p, i) => {
  console.log(`\nProject ${i}: ${p.name}`);
  console.log(`  _id: ${p._id}`);
  console.log(`  Idea: ${p.idea}`);
  console.log(`  Created: ${p.createdAt}`);
  console.log(`  Frontend: ${p.frontend ? p.frontend.length : 0} bytes`);
  console.log(`  Backend: ${p.backend ? p.backend.length : 0} bytes`);
});
