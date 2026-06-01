const fs = require('fs');
const db = JSON.parse(fs.readFileSync('local_db.json', 'utf8'));
const lastProj = db.projects[db.projects.length - 1];
console.log('Project details:');
console.log(JSON.stringify({
  _id: lastProj._id,
  id: lastProj.id,
  name: lastProj.name,
  idea: lastProj.idea,
  timestamp: lastProj.timestamp,
  createdAt: lastProj.createdAt,
  frontendLength: lastProj.frontend ? lastProj.frontend.length : 0,
  backendLength: lastProj.backend ? lastProj.backend.length : 0,
}, null, 2));
