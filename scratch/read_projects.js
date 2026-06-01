const fs = require('fs');
const db = JSON.parse(fs.readFileSync('local_db.json', 'utf8'));
console.log('Project Count:', db.projects.length);
db.projects.forEach((p, i) => {
    console.log(`${i}: _id=${p._id}, id=${p.id}, name="${p.name}", frontendLength=${p.frontend ? p.frontend.length : 0}`);
});
