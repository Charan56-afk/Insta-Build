const fs = require('fs');
const dbFile = 'local_db.json';
const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));

let patched = false;
db.projects.forEach(p => {
  if (p.name === 'CineStream' && p.frontend && p.frontend.includes("document.getElementById('login-form').addEventListener('submit'")) {
    p.frontend = p.frontend.replace(
      "document.getElementById('login-form').addEventListener('submit'",
      "const loginFormEl = document.getElementById('login-form');\n  if (loginFormEl) loginFormEl.addEventListener('submit'"
    );
    patched = true;
    console.log(`Patched CineStream frontend in DB.`);
  }
});

if (patched) {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
} else {
  console.log('No patching needed or CineStream name mismatch.');
}
