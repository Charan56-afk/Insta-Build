const fs = require('fs');
const db = require('../local_db.json');
const proj = db.projects.find(p => p._id === '6a1bfbd65798c03ea48f4bdd');
if (proj) {
    fs.writeFileSync('generated_fe.html', proj.frontend, 'utf8');
    fs.writeFileSync('generated_be.js', proj.backend, 'utf8');
    console.log('Successfully wrote generated_fe.html and generated_be.js');
} else {
    console.log('Project not found');
}
